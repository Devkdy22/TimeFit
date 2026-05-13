import React from 'react';
import { Character as UnifiedCharacter } from './CharacterWeb';

export type CharacterState = 'idle' | 'walk' | 'run' | 'urgent' | 'happy' | 'stressed';
export type CharacterTone = 'mint' | 'orange' | 'red';

export interface CharacterProps {
  size?: number;
  tone?: CharacterTone;
  state?: CharacterState;
}

type CharacterComponent = (props: CharacterProps) => React.JSX.Element;
const CharacterView = UnifiedCharacter as CharacterComponent;

export function Character(props: CharacterProps) {
  return <CharacterView {...props} />;
}
