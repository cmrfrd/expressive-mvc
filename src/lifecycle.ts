import { useEffect, useMemo } from 'react';

import { Controller } from './controller';
import { OBSERVER } from './observer';

export type LivecycleEvent =
  | "willMount"
  | "willUpdate"
  | "willRender"
  | "didRender"
  | "willReset"
  | "didMount"
  | "willUnmount"
  | "componentWillMount"
  | "componentWillUpdate"
  | "componentWillRender"
  | "componentDidMount"
  | "componentWillUnmount"
  | "elementWillMount"
  | "elementWillUpdate"
  | "elementWillRender"
  | "elementDidMount"
  | "elementWillUnmount";

export const lifecycleEvents = [
  "willReset",
  "willCycle",
  "willRender",
  "willUpdate",
  "willMount",
  "willUnmount",
  "didRender",
  "didMount"
];

const eventsFor = (prefix: string) => {
  const map = {} as BunchOf<string>;
  for(const name of lifecycleEvents)
    map[name] = prefix + name[0].toUpperCase() + name.slice(1);
  return map;
}

const subscriberLifecycle = eventsFor("element");
const componentLifecycle = eventsFor("component");

export function triggerLifecycle(
  control: Controller,
  name: LivecycleEvent,
  main: boolean,
  args?: any[]
){
  const lifecycle: BunchOf<string> = 
    main ? componentLifecycle : subscriberLifecycle;
    
  const specific = lifecycle[name] as LivecycleEvent;
  const handler = control[specific] || control[name];
      
  if(handler)
    handler.apply(control, args || []);
    
  control[OBSERVER].trigger(name, specific);
}

export function useLifecycleEffect(
  onEvent: (name: LivecycleEvent) => void){

  let isFirstRender;

  onEvent = useMemo(() => isFirstRender = onEvent, []);

  onEvent(isFirstRender ? "willMount" : "willUpdate");
  onEvent("willRender");

  useEffect(() => {
    onEvent("didRender");

    return () =>
      onEvent("willReset")
  })

  useEffect(() => {
    onEvent("didMount");

    return () =>
      onEvent("willUnmount");
  }, [])
}