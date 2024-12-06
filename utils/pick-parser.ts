export type ParsedPick = {
  team: string;
  spread?: number;
  over_under?: number;
  is_favorite?: boolean;
  is_over?: boolean;
  pick_type: 'spread' | 'over_under';
};

export function parsePick(input: string): ParsedPick | null {
  console.log('parsePick input:', input);
  const text = input.trim().toLowerCase();
  console.log('cleaned input:', text);
  
  const overUnderPattern = /^(\w+)\s+(o|over|u|under)\s*(\d+\.?\d*)$/i;
  const ouMatch = text.match(overUnderPattern);
  
  if (ouMatch) {
    console.log('over/under match:', ouMatch);
    const [_, team, direction, number] = ouMatch;
    const result = {
      team: team.trim(),
      over_under: parseFloat(number),
      is_over: direction.toLowerCase().startsWith('o'),
      pick_type: 'over_under' as const
    };
    console.log('returning over/under pick:', result);
    return result;
  }
  
  const spreadWordPattern = /^(.*?)\s+(minus|plus)\s+(\d+\.?\d*)$/i;
  const spreadSymbolPattern = /^(.*?)\s*([+-])(\d+\.?\d*)$/i;
  
  const spreadWordMatch = text.match(spreadWordPattern);
  const spreadSymbolMatch = text.match(spreadSymbolPattern);
  
  if (spreadWordMatch || spreadSymbolMatch) {
    const match = spreadWordMatch || spreadSymbolMatch;
    console.log('spread match:', match);
    const [_, team, direction, number] = match!;
    const isFavorite = direction === '-' || direction.toLowerCase() === 'minus';
    const result = {
      team: team.trim(),
      spread: parseFloat(number),
      is_favorite: isFavorite,
      pick_type: 'spread' as const
    };
    console.log('returning spread pick:', result);
    return result;
  }
  
  console.log('no match found, returning null');
  return null;
}

export function validatePick(pick: ParsedPick, availablePicks: number): string | null {
  console.log('validatePick input:', { pick, availablePicks });
  
  if (availablePicks <= 0) {
    return 'No picks remaining';
  }

  if (!pick.team.trim()) {
    return 'Team name is required';
  }

  if (pick.pick_type === 'over_under') {
    if (!pick.over_under || pick.over_under <= 0) {
      return 'Invalid over/under value';
    }
  } else {
    if (!pick.spread || pick.spread <= 0) {
      return 'Invalid spread value';
    }
  }
  
  console.log('validation passed');
  return null;
}

export function formatPick(pick: ParsedPick): string {
  if (pick.pick_type === 'over_under') {
    const direction = pick.is_over ? 'OVER' : 'UNDER';
    return `${pick.team} ${direction} ${pick.over_under}`;
  } else {
    return `${pick.team} ${pick.is_favorite ? '-' : '+'} ${pick.spread}`;
  }
}