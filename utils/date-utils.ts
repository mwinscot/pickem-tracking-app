// utils/date-utils.ts

export const toPSTDate = (date: string): string => {
  // Create a date object and get the PST date
  const d = new Date(date);
  
  // Get date parts in PST
  const pstDate = d.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  // Parse the PST date string
  const [datePart] = pstDate.split(',');
  const [month, day, year] = datePart.split('/');
  
  // Return in YYYY-MM-DD format
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

export const getDateRange = (baseDate: string): string[] => {
  // Parse the base date
  const [year, month, day] = baseDate.split('-').map(Number);
  
  // Create Date objects for yesterday, today, and tomorrow in PST
  const today = new Date(year, month - 1, day);
  const yesterday = new Date(year, month - 1, day - 1);
  const tomorrow = new Date(year, month - 1, day + 1);
  
  // Format all dates consistently
  return [
    toPSTDate(yesterday.toISOString()),
    toPSTDate(today.toISOString()),
    toPSTDate(tomorrow.toISOString())
  ];
};