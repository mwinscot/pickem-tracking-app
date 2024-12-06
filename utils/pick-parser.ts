export type ParsedPick = {
  team: string;
  spread: number;
  isFavorite: boolean;
};

export function parsePick(input: string): ParsedPick | null {
  // Clean up input
  const text = input.trim().toLowerCase();
  
  // Match pattern: [team] (minus|plus) [number]
  const pattern = /^(.*?)\s+(minus|plus)\s+(\d+\.?\d*)$/i;
  const match = text.match(pattern);
  
  if (!match) {
    return null;
  }
  
  const [_, team, direction, number] = match;
  const isFavorite = direction.toLowerCase() === 'minus';
  const spread = parseFloat(number);
  
  return {
    team: team.trim(),
    spread,
    isFavorite
  };
}

export function validatePick(pick: ParsedPick, availablePicks: number): string | null {
  if (availablePicks <= 0) {
    return 'No picks remaining';
  }
  
  if (pick.spread <= 0) {
    return 'Spread must be positive';
  }
  
  if (!pick.team) {
    return 'Team name is required';
  }
  
  return null;
}