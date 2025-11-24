import {
  ColDef,
  ColDefField,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';
import { IStatItem, ORDERED_LEVELS } from '../../../types/stats.types';
import { useTranslation } from 'react-i18next';

export function useStatsGridColumns() {
  const { t } = useTranslation();

  const statsGridColumnsFactory = (
    metric: string,
    dates: string[],
  ): ColDef<IStatItem>[] => {
    const metadataColumns: ColDef<IStatItem>[] = ORDERED_LEVELS.map(
      (level, index) => ({
        colId: level,
        headerName: t(`grid.columns.${level}`), // Локализованные заголовки
        field: level as ColDefField<IStatItem>,
        rowGroup: level !== 'article',
        rowGroupIndex: index,
        initialHide: true,
      }),
    );

    const sumColumn: ColDef<IStatItem> = {
      headerName: t('grid.columns.sum'), // "Сумма" или "Sum"
      colId: 'sums',
      valueGetter: (params: ValueGetterParams<IStatItem>) => {
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
      valueFormatter: (params: ValueFormatterParams<IStatItem>) => {
        return params.value?.toLocaleString('ru-RU') || '0';
      },
    };

    const averageColumn: ColDef<IStatItem> = {
      headerName: t('grid.columns.average'), // "Среднее" или "Average"
      colId: 'average',
      valueGetter: (params: ValueGetterParams<IStatItem>) => {
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
      valueFormatter: (params: ValueFormatterParams<IStatItem>) => {
        return params.value?.toFixed(2) || '0';
      },
    };

    const datesColumns: ColDef<IStatItem>[] = dates.map((date, index) => {
      const dataIndex = dates.length - 1 - index;

      return {
        headerName: `${t(`grid.columns.${metric}`)} ${date}`, // Локализованное название метрики + дата
        colId: `${index}`,
        valueGetter: (params: ValueGetterParams<IStatItem>) => {
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
        valueFormatter: (params: ValueFormatterParams<IStatItem>) => {
          return params.value?.toLocaleString() ?? '';
        },
      };
    });

    return [...metadataColumns, sumColumn, averageColumn, ...datesColumns];
  };

  return statsGridColumnsFactory;
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
