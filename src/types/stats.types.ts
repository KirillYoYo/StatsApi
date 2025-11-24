export enum Levels {
  type = 'type',
  article = 'article',
  brand = 'brand',
  supplier = 'supplier',
}

export const ORDERED_LEVELS = [
  Levels.supplier,
  Levels.brand,
  Levels.type,
  Levels.article,
] as const;

// данные с бэкенда
export interface IStatItemRaw {
  type: string; // тип
  article: string; // артикул
  brand: string; // бренд
  supplier: string; // поставщик
  cost: number[]; // цена в этот день за штуку
  orders: number[]; // заказы за день
  returns: number[]; // возвраты за день
  lastUpdate: string; // дата последнего обновления
}

export interface IStatItem {
  article: string;
  type: string;
  brand: string;
  supplier: string;
  cost: number[];
  orders: number[];
  returns: number[];
  lastUpdate: string;
  revenue?: number[];
  buyouts?: number[];
  totalCost?: number;
  totalOrders?: number;
  totalReturns?: number;
  totalRevenue?: number;
  totalBuyouts?: number;
  childCount?: number;
}
