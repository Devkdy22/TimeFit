import React from 'react';

export type CharacterState = 'idle' | 'walk' | 'run' | 'urgent' | 'happy' | 'stressed';
export type CharacterTone = 'mint' | 'orange' | 'red';

export interface CharacterProps {
  size?: number;
  tone?: CharacterTone;
  state?: CharacterState;
}

type CharacterComponent = (props: CharacterProps) => React.JSX.Element;
const UnifiedCharacter = require('./CharacterWeb').Character as CharacterComponent;

export function Character(props: CharacterProps) {
  return <UnifiedCharacter {...props} />;
}
