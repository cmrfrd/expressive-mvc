import { createElement, forwardRef, useEffect, useState, FC, HTMLProps } from 'react';

import { Controller, within } from './controller';
import { getObserver } from './observer';

function useTrackedValue(from: Controller, key: string){
  const [ value, onUpdate ] = useState(() => within(from, key));

  useEffect(() => {
    return getObserver(from).watch(key, onUpdate);
  }, []);

  return value;
}

export function ControlledValue(
  this: Controller): FC<{ of: string }> {

  return ({ of: key, ...props }) => {
    const current = useTrackedValue(this, key);
    return createElement("span", props, current);
  }
}

type onChangeCallback = (v: any, e: any) => any;
type ControlledInputProps = 
  HTMLProps<HTMLInputElement> & { 
    to: string, 
    type?: string,
    onUpdate?: onChangeCallback | string | false,
    onReturn?: onChangeCallback | string
  }

export function ControlledInput(this: Controller){
  return forwardRef<unknown, ControlledInputProps>((props, ref) => {
    const { to: key, onChange, onReturn, ...outsideProps } = props;

    const value = useTrackedValue(this, key);
    const controlledProps = useControlledInputProps.call(this, key, props)
    
    return createElement("input", {
      ref,
      value,
      type: "text",
      ...outsideProps,
      ...controlledProps
    })
  })
}

function useControlledInputProps(
  this: Controller,
  key: string,
  props: Omit<ControlledInputProps, "to">){

  const [ controlProps ] = useState(() => {
    let { onChange, onReturn, type } = props;
    const tracked = within(this);
    const controlProps = {} as any;

    if(typeof onChange == "string")
      onChange = this[onChange] as onChangeCallback;

    if(typeof onChange == "function")
      controlProps.onChange = (e: any) => {
        let { value } = e.target;

        if(type == "number")
          value = Number(value);

        const returned = (onChange as any)(value, e);

        if(returned !== undefined)
          tracked[key] = returned;
      }
    else if(onChange !== false)
      if(type == "number")
        controlProps.onChange = (e: any) => { 
          tracked[key] = Number(e.target.value) 
        }
      else
        controlProps.onChange = (e: any) => { 
          tracked[key] = e.target.value 
        }

    if(typeof onReturn == "string")
      onReturn = this[onReturn] as onChangeCallback;

    if(typeof onReturn == "function"){
      controlProps.onKeyPress = (e: any) => {
        if(e.which !== 13)
          return;

        e.preventDefault();
        let { value } = e.target;

        if(type == "number")
          value = Number(value);

        const returned = (onReturn as any)(value, e);

        if(returned)
          tracked[key] = returned;
      }
    }

    return controlProps;
  });

  return controlProps;
}