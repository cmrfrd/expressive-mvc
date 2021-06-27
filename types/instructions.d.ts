import Model from '.';
import { Async, Class, EffectCallback, InstanceOf, RefFunction } from './types';

/**
   * Creates a new child-instance of specified controller.
   * 
   * @param Peer - Type of Model to create and apply to host property.
   * @param callback - Fired after controller is created and ready for use.
   */
 export function use <T extends typeof Model> (Peer: T, callback?: (i: InstanceOf<T>) => void): InstanceOf<T> 

 /**
  * Fetches and assigns the controller which spawned this host.
  * When parent assigns an instance via `use()` directive, it
  * will be made available to child upon this request.
  * 
  * @param Expects - Type of controller compatible with this class. 
  * @param required - Throw if controller is created independantly.
  */
 export function parent <T extends typeof Model> (Expects: T, required: true): InstanceOf<T>;
 export function parent <T extends typeof Model> (Expects: T, required?: false): InstanceOf<T> | undefined;
 
 /**
  * Find and attach most applicable instance of Model via context.
  * 
  * Expects a `<Provider>` of target controller to exist. 
  * Host controller will search element-hierarchy relative to where it spawned.
  * 
  * @param Type - Type of controller to attach to property. 
  * @param required - Throw if instance of Type cannot be found.
  */
 export function tap <T extends Class> (Type: T, required?: boolean): InstanceOf<T>;
 
 /**
  * Sets property to synchronously call an effect upon update (much like a setter).
  * 
  * **Note:** Use generic-type to specifiy property signature. 
  * Value will always start off as undefined. 
  * 
  * @param callback - Effect-callback fired upon update of host property.
  */
 export function on <T = any> (callback: EffectCallback<T>): T | undefined;

 /**
  * Sets property to synchronously call effect upon update.
  * 
  * @param starting - Beginning value of host property.
  * @param callback - Effect-callback fired upon set of host property.
  */
 export function on <T = any> (starting: T, callback: EffectCallback<T>): T;
 
 /**
  * Creates a ref-compatible property for use with components.
  * Will persist value, and updates to this are made part of controller event-stream.
  * 
  * *Output is simultaneously a ref-function and ref-object, use as needed.*
  * 
  * @param callback - Optional callback to synchronously fire when reference is first set or does update.
  */
 export function ref <T = HTMLElement> (callback?: EffectCallback<T>): ((next: T) => void) & { current: T | null };
 
 /**
  * Create Plug-n-Play references for properties of this controller.
  * 
  * Matched ref-functions automatically bind between receiving element and value of field.
  * 
  * For `<input type="text" />` this is a two-way binding.
  * User input is captured and part of controller's state/event stream.
  */
 export function binds <T extends Model> (from: T): Model.Overlay<T, RefFunction>;
 
 /**
  * Sets an exotic method with managed ready-state. Property accepts an async function.
  * 
  * When an act-method is invoked, its `active` property to true for duration of call.
  * This is emitted as an update to property, both when called and after returns (or throws).
  * 
  * **Note:** Subsequent calls will immediately throw if one is still pending.
  * 
  * @param action - Action to fire when resulting property is invoked.
  */
 export function act <T extends Async>(action: T): T & { active: boolean };
 
 /**
  * Implement a computed value; output will be generated by provided function.
  * 
  * *Alternative to using native getters; works exactly the same!*
  * 
  * @param fn - Factory function to generate value and subscribe dependancies.
  */
 export function from <T, R>(fn: (this: T, on: T) => R): R;

 /**
  * Memoized value. Computes and stores a value returned by provided factory. 
  * Equivalent to a getter, sans the automatic updates.
  * 
  * @param compute - Factory for memoized value.
  * @param lazy - Wait until accessed to introduce value.
  */
 export function memo <T> (compute: () => T, lazy?: boolean): T;
 
 /**
  * Flag property as not to be tracked. Useful if changes often with no real-time impact.
  * 
  * @param value - starting value of property.
  */
 export function lazy <T> (value?: T): T;