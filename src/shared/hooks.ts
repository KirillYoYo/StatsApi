import { useState, useEffect } from 'react';

export function useBootstrapTheme() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('bs-theme');
    const systemDark = window.matchMedia(
      '(prefers-color-scheme: dark)',
    ).matches;
    return saved ? saved === 'dark' : systemDark;
  });

  useEffect(() => {
    const htmlElement = document.documentElement;

    if (isDark) {
      htmlElement.setAttribute('data-bs-theme', 'dark');
      localStorage.setItem('bs-theme', 'dark');
    } else {
      htmlElement.setAttribute('data-bs-theme', 'light');
      localStorage.setItem('bs-theme', 'light');
    }
  }, [isDark]);

  return { isDark, setIsDark };
}

import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { ORDERED_LEVELS } from '../types/stats.types';

export function useGridLocalization() {
  const { t } = useTranslation();

  const localeText = useMemo(
    () => ({
      noRowsToShow: t('grid.noRowsToShow'),
      loadingOoo: t('grid.loadingOoo'),
      page: t('grid.page'),
      more: t('grid.more'),
      to: t('grid.to'),
      of: t('grid.of'),
      next: t('grid.next'),
      last: t('grid.last'),
      first: t('grid.first'),
      previous: t('grid.previous'),

      filterOoo: t('grid.filterOoo'),
      equals: t('grid.equals'),
      notEqual: t('grid.notEqual'),
      lessThan: t('grid.lessThan'),
      greaterThan: t('grid.greaterThan'),
      inRange: t('grid.inRange'),
      contains: t('grid.contains'),
      notContains: t('grid.notContains'),
      startsWith: t('grid.startsWith'),
      endsWith: t('grid.endsWith'),
      searchOoo: t('grid.searchOoo'),
      selectAll: t('grid.selectAll'),
      blank: t('grid.blank'),
      notBlank: t('grid.notBlank'),

      applyFilter: t('grid.applyFilter'),
      resetFilter: t('grid.resetFilter'),
      clearFilter: t('grid.clearFilter'),

      group: t('grid.group'),
      ungroup: t('grid.ungroup'),
      sortAscending: t('grid.sortAscending'),
      sortDescending: t('grid.sortDescending'),
      clearSort: t('grid.clearSort'),
    }),
    [t],
  );

  const getLocalizedColumnDefs = useMemo(() => {
    return (metric: string, dates: string[]) => {
      const metadataColumns = ORDERED_LEVELS.map((level, index) => ({
        colId: level,
        headerName: t(`grid.columns.${level}`),
        field: level,
        rowGroup: level !== 'article',
        rowGroupIndex: index,
        initialHide: true,
      }));

      const sumColumn = {
        headerName: t('grid.columns.sum'),
        colId: 'sums',
        // ... valueGetter и valueFormatter
      };

      const averageColumn = {
        headerName: t('grid.columns.average'),
        colId: 'average',
      };

      const datesColumns = dates.map((date, index) => ({
        headerName: `${t(`grid.columns.${metric}`)} ${date}`,
        colId: `${index}`,
      }));

      return [...metadataColumns, sumColumn, averageColumn, ...datesColumns];
    };
  }, [t]);

  return { localeText, getLocalizedColumnDefs };
}
