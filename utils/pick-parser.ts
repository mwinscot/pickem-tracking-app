export type ParsedPick = {
  team: string;
  spread?: number;
  over_under?: number;
  is_favorite: boolean;
  is_over_under: boolean;
};

export function parsePick(input: string): ParsedPick | null {
  // Clean up input
  const text = input.trim().toLowerCase();
  
  // Try to match over/under pattern with required team
  // Matches patterns like "Stanford O147.5" or "Stanford over 147.5"
  const overUnderPattern = /^(\w+)\s+(o|over|u|under)\s*(\d+\.?\d*)$/i;
  const ouMatch = text.match(overUnderPattern);
  
  if (ouMatch) {
    const [_, team, direction, number] = ouMatch;
    if (!team) {
      return null; // Team is required
    }
    const isOver = direction.toLowerCase().startsWith('o');
    return {
      team: team.trim(),
      over_under: parseFloat(number),
      is_favorite: isOver, // Using is_favorite to indicate over (true) or under (false)
      is_over_under: true
    };
  }
  
  // Try to match spread patterns:
  // 1. Words: "Duke minus 3.5" or "Duke plus 3.5"
  // 2. Symbols: "Duke -3.5" or "Duke +3.5"
  const spreadWordPattern = /^(.*?)\s+(minus|plus)\s+(\d+\.?\d*)$/i;
  const spreadSymbolPattern = /^(.*?)\s*([+-])(\d+\.?\d*)$/i;
  
  const spreadWordMatch = text.match(spreadWordPattern);
  const spreadSymbolMatch = text.match(spreadSymbolPattern);
  
  if (spreadWordMatch) {
    const [_, team, direction, number] = spreadWordMatch;
    const isFavorite = direction.toLowerCase() === 'minus';
    return {
      team: team.trim(),
      spread: parseFloat(number),
      is_favorite: isFavorite,
      is_over_under: false
    };
  }
  
  if (spreadSymbolMatch) {
    const [_, team, symbol, number] = spreadSymbolMatch;
    const isFavorite = symbol === '-';
    return {
      team: team.trim(),
      spread: parseFloat(number),
      is_favorite: isFavorite,
      is_over_under: false
    };
  }
  
  return null;
}

export function validatePick(pick: ParsedPick, availablePicks: number): string | null {
  if (availablePicks <= 0) {
    return 'No picks remaining';
  }

  if (!pick.team.trim()) {
    return 'Team name is required';
  }

  if (pick.is_over_under) {
    if (!pick.over_under || pick.over_under <= 0) {
      return 'Invalid over/under value';
    }
  } else {
    if (!pick.spread || pick.spread <= 0) {
      return 'Invalid spread value';
    }
  }
  
  return null;
}

export function formatPick(pick: ParsedPick): string {
  if (pick.is_over_under) {
    const direction = pick.is_favorite ? 'OVER' : 'UNDER';
    return `${pick.team} ${direction} ${pick.over_under}`;
  } else {
    return `${pick.team} ${pick.is_favorite ? '-' : '+'} ${pick.spread}`;
  }
}