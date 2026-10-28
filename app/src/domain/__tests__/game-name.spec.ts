import { describe, expect, it } from 'vite-plus/test';

import { formatGameName } from '../game-name';

describe('formatGameName', () => {
  it('shortens Manual games and splits the camel case name', () => {
    expect(formatGameName('Manual_PokemonSV_asdagigafo')).toBe('Manual: Pokemon SV');
    expect(formatGameName('Manual_WatchShows_commanderdot')).toBe('Manual: Watch Shows');
    expect(formatGameName('Manual_AceCombat7_Qairyl')).toBe('Manual: Ace Combat 7');
    expect(formatGameName('Manual_MK8D_RampantEpsilon')).toBe('Manual: MK8D');
    expect(formatGameName('Manual_MarioKartSeries_arg7')).toBe('Manual: Mario Kart Series');
    expect(formatGameName('Manual_pokemonshsw_Riannehx')).toBe('Manual: pokemonshsw');
  });

  it('keeps names that already have spaces', () => {
    expect(formatGameName('Manual_Hyrule Warriors Definitive Edition (Demo)_MaudeTheMawile')).toBe(
      'Manual: Hyrule Warriors Definitive Edition (Demo)',
    );
  });

  it('keeps other game names', () => {
    expect(formatGameName('Hollow Knight')).toBe('Hollow Knight');
    expect(formatGameName('Manual')).toBe('Manual');
    expect(formatGameName('Manual_Only')).toBe('Manual_Only');
  });
});
