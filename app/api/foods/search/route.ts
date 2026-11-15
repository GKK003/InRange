import { NextRequest, NextResponse } from 'next/server';
import { authorizeAppRequest, isAuthError } from '@/lib/api-auth';

export const runtime = 'nodejs';

function offFood(product: any) {
  const n = product.nutriments || {};
  const serving = product.serving_size || `${product.serving_quantity || 100} g`;
  return {
    description: product.product_name || 'Food product',
    brand: product.brands || '',
    serving,
    carbs: Number(n.carbohydrates_serving ?? n.carbohydrates_100g ?? 0),
    fiber: Number(n.fiber_serving ?? n.fiber_100g ?? 0),
    sugars: Number(n.sugars_serving ?? n.sugars_100g ?? 0),
    barcode: product.code,
  };
}

export async function GET(req: NextRequest) {
  const auth = await authorizeAppRequest(req);
  if (isAuthError(auth)) return auth;
  const q = req.nextUrl.searchParams.get('q')?.trim();
  const barcode = req.nextUrl.searchParams.get('barcode')?.trim();
  if (!q && !barcode) return NextResponse.json({ foods: [] });
  if (barcode && !/^\d{8,14}$/.test(barcode)) {
    return NextResponse.json({ error: 'Barcode must contain 8–14 digits' }, { status: 400 });
  }

  try {
    const key = process.env.USDA_API_KEY;
    if (key) {
      const query = barcode || q!;
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&dataType=Branded,Foundation,SR%20Legacy&pageSize=12&api_key=${encodeURIComponent(key)}`;
      const response = await fetch(url, { next: { revalidate: 300 } });
      if (response.ok) {
        const data = await response.json();
        const foods = (data.foods || []).filter((food: any) => !barcode || String(food.gtinUpc || '').replace(/\D/g, '') === barcode).map((food: any) => {
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
        }).filter((food: any) => food.carbs > 0);
        if (foods.length) return NextResponse.json({ foods, source: 'USDA' });
      }
    }

    const offUrl = barcode
      ? `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`
      : `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q!)}&json=1&page_size=8&fields=product_name,brands,serving_size,serving_quantity,nutriments,code`;
    const response = await fetch(offUrl, { next: { revalidate: 300 } });
    if (!response.ok) return NextResponse.json({ foods: [], source: 'none' });
    const data = await response.json();
    const products = barcode ? (data.status === 1 && data.product ? [data.product] : []) : (data.products || []);
    const foods = products.map(offFood).filter((food: any) => food.description !== 'Food product' && food.carbs > 0);
    return NextResponse.json({ foods, source: foods.length ? 'Open Food Facts' : 'none' });
  } catch {
    return NextResponse.json({ foods: [], error: 'Food search unavailable' }, { status: 502 });
  }
}
