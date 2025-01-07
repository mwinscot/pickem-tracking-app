export const toPSTDate = (date: string | Date = new Date()): string => {
  const utcDate = typeof date === 'string' ? new Date(date) : date;
  const pstDate = new Date(utcDate.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return pstDate.toISOString().split('T')[0];
};

export const formatPSTDisplay = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-US', { 
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
};

export const getDateRange = (date: string): string[] => {
  const baseDate = new Date(date);
  const prevDay = new Date(baseDate);
  const nextDay = new Date(baseDate);
  
  prevDay.setDate(baseDate.getDate() - 1);
  nextDay.setDate(baseDate.getDate() + 1);
  
  return [
    prevDay.toISOString().split('T')[0],
    baseDate.toISOString().split('T')[0],
    nextDay.toISOString().split('T')[0]
  ];
};