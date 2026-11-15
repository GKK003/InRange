import { NextRequest, NextResponse } from 'next/server';
import { authorizeAppRequest, isAuthError } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const offHeaders = { 'User-Agent': 'InRange/1.0 (food lookup)' };

function barcodeVariants(raw: string) {
  const digits = raw.replace(/\D/g, '');
  const variants = new Set([digits]);
  // UPC-A and EAN-13 commonly represent the same US product with a leading zero.
  if (digits.length === 12) variants.add(`0${digits}`);
  if (digits.length === 13 && digits.startsWith('0')) variants.add(digits.slice(1));
  // Expand compressed UPC-E to its equivalent UPC-A code for provider lookups.
  if (digits.length === 8 && /^[01]/.test(digits)) {
    const ns = digits[0];
    const [a, b, c, d, e, f, check] = digits.slice(1).split('');
    let manufacturer = '';
    let product = '';
    if ('012'.includes(f)) { manufacturer = `${a}${b}${f}00`; product = `00${c}${d}${e}`; }
    else if (f === '3') { manufacturer = `${a}${b}${c}00`; product = `000${d}${e}`; }
    else if (f === '4') { manufacturer = `${a}${b}${c}${d}0`; product = `0000${e}`; }
    else { manufacturer = `${a}${b}${c}${d}${e}`; product = `0000${f}`; }
    const upcA = `${ns}${manufacturer}${product}${check}`;
    variants.add(upcA);
    variants.add(`0${upcA}`);
  }
  return Array.from(variants).filter(code => /^\d{8,14}$/.test(code));
}

function usdaFood(food: any) {
  const nutrients = food.foodNutrients || [];
  const value = (needle: string) => Number(nutrients.find((n: any) => n.nutrientName?.toLowerCase().includes(needle))?.value || 0);
  return {
    description: food.description,
    brand: food.brandOwner || food.brandName || '',
    serving: food.householdServingFullText || `${food.servingSize || 100} ${food.servingSizeUnit || 'g'}`,
    carbs: value('carbohydrate'),
    fiber: value('fiber'),
    sugars: value('sugars'),
    barcode: food.gtinUpc,
  };
}

function offFood(product: any) {
  const n = product.nutriments || {};
  const hasServingValues = n.carbohydrates_serving !== undefined;
  return {
    description: product.product_name || 'Food product',
    brand: product.brands || '',
    serving: hasServingValues && product.serving_size ? product.serving_size : '100 g',
    carbs: Number(hasServingValues ? n.carbohydrates_serving : n.carbohydrates_100g || 0),
    fiber: Number(hasServingValues ? n.fiber_serving ?? n.fiber_100g ?? 0 : n.fiber_100g || 0),
    sugars: Number(hasServingValues ? n.sugars_serving ?? n.sugars_100g ?? 0 : n.sugars_100g || 0),
    barcode: product.code,
  };
}

function hasNutrition(food: any) {
  return food.description !== 'Food product' && Number.isFinite(food.carbs) && food.carbs >= 0;
}

export async function GET(req: NextRequest) {
  const auth = await authorizeAppRequest(req);
  if (isAuthError(auth)) return auth;
  const q = req.nextUrl.searchParams.get('q')?.trim();
  const rawBarcode = req.nextUrl.searchParams.get('barcode')?.trim();
  if (!q && !rawBarcode) return NextResponse.json({ foods: [] });
  if (rawBarcode && !/^\d{8,14}$/.test(rawBarcode)) {
    return NextResponse.json({ error: 'Barcode must contain 8–14 digits' }, { status: 400 });
  }

  try {
    const key = process.env.USDA_API_KEY;
    if (rawBarcode) {
      const variants = barcodeVariants(rawBarcode);
      if (key) {
        const responses = await Promise.all(variants.map(code => fetch(
          `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(code)}&dataType=Branded&pageSize=12&api_key=${encodeURIComponent(key)}`,
          { next: { revalidate: 300 } },
        ).then(response => response.ok ? response.json() : null).catch(() => null)));
        const candidates = responses.flatMap(data => data?.foods || []);
        const allowed = new Set(variants);
        const foods = candidates
          .filter((food: any) => allowed.has(String(food.gtinUpc || '').replace(/\D/g, '')))
          .map(usdaFood)
          .filter(hasNutrition);
        if (foods.length) return NextResponse.json({ foods, source: 'USDA' });
      }

      const products = await Promise.all(variants.map(code => fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,serving_size,serving_quantity,nutriments,code`,
        { headers: offHeaders, next: { revalidate: 300 } },
      ).then(response => response.ok ? response.json() : null).catch(() => null)));
      const foods = products
        .filter(data => data?.status === 1 && data.product)
        .map(data => offFood(data.product))
        .filter(hasNutrition);
      if (foods.length) return NextResponse.json({ foods: foods.slice(0, 5), source: 'Open Food Facts' });
      return NextResponse.json({ foods: [], source: 'none', message: 'No catalog match. Try searching the product name or check the barcode.' });
    }

    if (key) {
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q!)}&dataType=Branded,Foundation,SR%20Legacy&pageSize=12&api_key=${encodeURIComponent(key)}`;
      const response = await fetch(url, { next: { revalidate: 300 } });
      if (response.ok) {
        const data = await response.json();
        const foods = (data.foods || []).map(usdaFood).filter((food: any) => food.carbs > 0);
        if (foods.length) return NextResponse.json({ foods, source: 'USDA' });
      }
    }

    const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q!)}&json=1&page_size=8&fields=product_name,brands,serving_size,serving_quantity,nutriments,code`;
    const response = await fetch(offUrl, { headers: offHeaders, next: { revalidate: 300 } });
    if (!response.ok) return NextResponse.json({ foods: [], source: 'none' });
    const data = await response.json();
    const foods = (data.products || []).map(offFood).filter(hasNutrition);
    return NextResponse.json({ foods, source: foods.length ? 'Open Food Facts' : 'none' });
  } catch {
    return NextResponse.json({ foods: [], error: 'Food lookup service unavailable. Try again or search by name.' }, { status: 502 });
  }
}
