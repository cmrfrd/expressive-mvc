import Model from '.';

declare namespace Directives {
  type Async = (...args: any[]) => Promise<any>;

  /**
   * Creates a new child-instance of specified controller.
   * 
   * @param Peer - Type of Model to create and apply to host property.
   * @param callback - Fired after controller is created and ready for use.
   */
  export function setChild <T extends typeof Model> (Peer: T, callback?: (i: InstanceOf<T>) => void): InstanceOf<T> 

  /**
   * Fetches and assigns the controller which spawned this host.
   * When parent assigns an instance via `use()` directive, it
   * will be made available to child upon this request.
   * 
   * @param Expects - Type of controller compatible with this class. 
   * @param required - Throw if controller is created independantly.
   */
  export function setParent <T extends typeof Model> (Expects: T, required: true): InstanceOf<T>;
  export function setParent <T extends typeof Model> (Expects: T, required?: false): InstanceOf<T> | undefined;
  
  /**
   * Find and attach most applicable instance of Model via context.
   * 
   * Expects a `<Provider>` of target controller to exist. 
   * Host controller will search element-hierarchy relative to where it spawned.
   * 
   * @param Type - Type of controller to attach to property. 
   * @param required - Throw if instance of Type cannot be found.
   */
  export function setPeer <T extends Class> (Type: T, required?: boolean): InstanceOf<T>;
  
  /**
   * Sets property to synchronously call an effect upon update (much like a setter).
   * 
   * **Note:** Use generic-type to specifiy property signature. 
   * Value will always start off as undefined. 
   * 
   * @param callback - Effect-callback fired upon update of host property.
   */
  export function setEffect <T = any> (callback: EffectCallback<T>): T | undefined;

  /**
   * Sets property to synchronously call effect upon update.
   * 
   * @param starting - Beginning value of host property.
   * @param callback - Effect-callback fired upon set of host property.
   */
  export function setEffect <T = any> (starting: T, callback: EffectCallback<T>): T;
  
  /**
   * Creates a ref-object for use with components.
   * Will persist value, and updates to this ref are part of controller event-stream.
   * 
   * @param callback - Optional callback to synchronously fire when reference is first set or does update.
   */
  export function setReference <T = HTMLElement> (callback?: EffectCallback<T>): { current: T | null };
  
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
  export function setAction <T extends Async>(action: T): T & { active: boolean };

  /**
   * Memoized value. Computes and stores a value returned by provided factory. 
   * Equivalent to a getter, sans the automatic updates.
   * 
   * @param compute - Factory for memoized value.
   * @param lazy - Wait until accessed to introduce value.
   */
  export function setMemo <T> (compute: () => T, lazy?: boolean): T;
  
  /**
   * Spawns read-only array/object of specified shape.
   * 
   * Updates to property are compared to existing value.
   * Will squash update if all fields are strict-equal, or either old-new values are undefined.
   * 
   * @param initial - Starting value of property. May be an object or array.
   */
  export function setTuple <T extends readonly any[] = []> (): Readonly<T> | undefined;
  export function setTuple <T extends readonly any[]> (initial: T): Readonly<T>;
  export function setTuple <T extends {}> (initial: T): Readonly<T>;

  /**
   * Spawns read-only array/object of specified shape.
   * 
   * Updates to property are compared to existing value.
   * Will squash update if all fields are strict-equal, or either old-new values are undefined.
   * 
   * @param values - Arguments are set to initial array's values.
   */
  export function setTuple <T extends readonly any[]> (...values: T): Readonly<T>;
  
  /**
   * Default value of property.
   * 
   * This, unlike naked instance-properties, allows an inheritor's getter to override this value.
   * 
   * @param value
   */
  export function setValue <T> (value: T): T; 
  
  /**
   * Flag property as not to be tracked. Useful if changes often with no real-time impact.
   * 
   * @param value - starting value of property.
   */
  export function setIgnored <T> (value?: T): T;
  
  /**
   * Generate custom HOC to which host controller is provided.
   * 
   * @param component - Component which may recieve host controller as context parameter.
   */
  export function setComponent <T extends Model, P> (component: Model.Component<P, T>): React.ComponentType<P>;
  
  /**
   * Generates custom `Provider` using specified component.
   * Component receives instance of host under its context parameter.
   * 
   * **Note:** Props forwarded rather than sent to host controller, as with built-in.
   * 
   * @param component - Component which defines body of custom provider.
   */
  export function setParentComponent <T extends Model, P> (component: Model.Component<P, T>): React.ComponentType<P>;
  
  /**
   * Generates a bound component useable within FC's, using hooked instance of host controller.
   * 
   * Updates to property will *directly affect resulting element in real-time*,
   * and ***does not trigger a render*** of the component where used.
   * 
   * This makes it easy to present data points which may change extremely often,
   * while also avoiding an expensive render-cycle.
   * 
   * @param Component - Compatible component to which a forwarded ref is accepted.
   * @param to - Property which bound component shall bind to.
   */
  export function setBoundComponent <P, T = HTMLElement> (Component: Model.Component<P, T>, to: string): React.ComponentType<P>;
}

export = Directives;