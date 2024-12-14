// utils/date-utils.ts

export const toPSTDate = (dateString: string): string => {
  // Create a date object
  const date = new Date(dateString);
  
  // Get the date in PST/PDT
  const pstDate = new Date(date.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles'
  }));
  
  // Format as YYYY-MM-DD
  return pstDate.toISOString().split('T')[0];
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