// utils/date-utils.ts

export const toPSTDate = (date: string): string => {
  // Use PST timezone (UTC-8)
  const d = new Date(date);
  // Convert to PST
  const pstString = d.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  // Convert MM/DD/YYYY to YYYY-MM-DD
  const [month, day, year] = pstString.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

export const getDateRange = (baseDate: string): string[] => {
  const d = new Date(baseDate);
  
  // Get yesterday
  const yesterday = new Date(d);
  yesterday.setDate(d.getDate() - 1);
  
  // Get tomorrow
  const tomorrow = new Date(d);
  tomorrow.setDate(d.getDate() + 1);
  
  // Convert all dates to PST
  return [
    toPSTDate(yesterday.toISOString()),
    toPSTDate(d.toISOString()),
    toPSTDate(tomorrow.toISOString())
  ];
};