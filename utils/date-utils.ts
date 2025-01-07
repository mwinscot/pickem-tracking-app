// utils/date-utils.ts

export const toPSTDate = (date: string | Date = new Date()): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Date(d.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
    .toISOString()
    .split('T')[0];
};

export const formatPSTDisplay = (dateString: string): string => {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };
  
  return new Date(dateString).toLocaleString('en-US', options);
};

export const getDateRange = (baseDate: string): string[] => {
  // Parse the base date
  const date = new Date(baseDate);
  
  // Create dates for yesterday and tomorrow
  const yesterday = new Date(date);
  yesterday.setDate(date.getDate() - 1);
  
  const tomorrow = new Date(date);
  tomorrow.setDate(date.getDate() + 1);
  
  return [
    yesterday.toISOString().split('T')[0],
    date.toISOString().split('T')[0],
    tomorrow.toISOString().split('T')[0]
  ];
};