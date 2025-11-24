import {
  ColDef,
  ColDefField,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';
import { IStatItem, ORDERED_LEVELS } from '../../../types/stats.types';
import { METADATA_LABELS } from '../stats.const';

export function statsGridColumnsFactory<T extends IStatItem>(
  metric: string,
  dates: string[],
): ColDef<T>[] {
  const metadataColumns: ColDef<T>[] = ORDERED_LEVELS.map((level, index) => ({
    colId: level,
    headerName: METADATA_LABELS[level],
    field: level as ColDefField<T>,
    rowGroup: level !== 'article',
    rowGroupIndex: index,
    initialHide: true,
  }));

  const sumColumn: ColDef<T> = {
    headerName: 'Sum',
    colId: 'sums',
    valueGetter: (params: ValueGetterParams<T>) => {
      const data = params.data;
      if (!data) return 0;

      switch (metric) {
        case 'cost':
          return data.totalCost || calculateTotal(data.cost);
        case 'orders':
          return data.totalOrders || calculateTotal(data.orders);
        case 'returns':
          return data.totalReturns || calculateTotal(data.returns);
        case 'revenue':
          return data.totalRevenue || calculateTotal(calculateRevenue(data));
        case 'buyouts':
          return data.totalBuyouts || calculateTotal(calculateBuyouts(data));
        default:
          return 0;
      }
    },
    valueFormatter: (params: ValueFormatterParams<T>) => {
      return params.value?.toLocaleString('ru-RU') || '0';
    },
  };

  const averageColumn: ColDef<T> = {
    headerName: 'Average',
    colId: 'average',
    valueGetter: (params: ValueGetterParams<T>) => {
      const data = params.data;
      if (!data) return 0;

      const metricData = getMetricArray(data, metric);
      if (metricData && metricData.length > 0) {
        const sum = metricData.reduce(
          (sum: number, value: number) => sum + value,
          0,
        );
        return sum / metricData.length;
      }

      return 0;
    },
    valueFormatter: (params: ValueFormatterParams<T>) => {
      return params.value?.toFixed(2) || '0';
    },
  };

  const datesColumns: ColDef<T>[] = dates.map((date, index) => {
    const dataIndex = dates.length - 1 - index;

    return {
      headerName: date,
      colId: `${index}`,
      valueGetter: (params: ValueGetterParams<T>) => {
        const data = params.data;
        if (!data) return 0;

        if (metric === 'revenue') {
          return calculateDailyRevenue(data, dataIndex);
        }

        if (metric === 'buyouts') {
          return calculateDailyBuyouts(data, dataIndex);
        }

        const metricData = getMetricArray(data, metric);
        return metricData?.[dataIndex] || 0;
      },
      valueFormatter: (params: ValueFormatterParams<T>) => {
        return params.value?.toLocaleString() ?? '';
      },
    };
  });

  return [...metadataColumns, sumColumn, averageColumn, ...datesColumns];
}

function calculateDailyRevenue(data: IStatItem, dayIndex: number): number {
  if (!data.cost || !data.orders || !data.returns) return 0;

  const cost = data.cost[dayIndex] || 0;
  const orders = data.orders[dayIndex] || 0;
  const returns = data.returns[dayIndex] || 0;
  const buyouts = orders - returns;

  return cost * buyouts;
}

function calculateDailyBuyouts(data: IStatItem, dayIndex: number): number {
  if (!data.orders || !data.returns) return 0;

  const orders = data.orders[dayIndex] || 0;
  const returns = data.returns[dayIndex] || 0;

  return Math.max(0, orders - returns);
}

function calculateRevenue(data: IStatItem): number[] {
  if (!data.cost || !data.orders || !data.returns) return [];

  return data.cost.map((cost, index) => {
    const orders = data.orders![index] || 0;
    const returns = data.returns![index] || 0;
    const buyouts = Math.max(0, orders - returns);

    return cost * buyouts;
  });
}

function calculateBuyouts(data: IStatItem): number[] {
  if (!data.orders || !data.returns) return [];

  return data.orders.map((orders, index) => {
    const returns = data.returns![index] || 0;
    return Math.max(0, orders - returns);
  });
}

function calculateTotal(array: number[] | undefined): number {
  if (!array || !Array.isArray(array)) return 0;
  return array.reduce((sum, value) => sum + value, 0);
}

function getMetricArray(data: IStatItem, metric: string): number[] | null {
  if (!data) return null;

  switch (metric) {
    case 'cost':
      return data.cost || [];
    case 'orders':
      return data.orders || [];
    case 'returns':
      return data.returns || [];
    case 'revenue':
      return data.revenue || [];
    case 'buyouts':
      return data.buyouts || [];
    default:
      return null;
  }
}
