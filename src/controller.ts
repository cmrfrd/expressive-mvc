import * as Computed from './compute';
import { Pending } from './instruction';
import { issues } from './issues';
import { CONTROL, Stateful, UPDATE } from './model';
import { defineProperty, getOwnPropertyDescriptor } from './util';

export const Oops = issues({
  StrictUpdate: (expected) => 
    `Strict update() did ${expected ? "not " : ""}find pending updates.`,

  NoChaining: () =>
    `Then called with undefined; update promise will never catch nor supports chaining.`
});

declare namespace Controller {
  type Listen = (key: string, source: Controller) => RequestCallback | void;
  type OnValue = <T>(this: T, value: any, state: T) => boolean | void;
}

class Controller {
  public state!: BunchOf<any>;
  public frame = new Set<string>();
  public waiting = new Set<RequestCallback>();
  public onDestroy = new Set<Callback>();

  protected followers = new Set<Controller.Listen>();

  constructor(public subject: Stateful){}

  public start(){
    this.state = {};

    for(const key in this.subject)
      this.manage(key);

    const handle = new Set(this.waiting);
    this.waiting.clear();
    handle.forEach(cb => cb([]));

    return this;
  }

  public manage(
    key: string,
    handler?: Controller.OnValue){

    const { state, subject } = this;
    const desc = getOwnPropertyDescriptor(subject, key);

    if(desc && "value" in desc){
      const { value } = desc;
      const instruction = Pending.get(value);

      if(instruction){
        Pending.delete(value);
        delete (subject as any)[key];
        instruction.call(this, key, this);
      }
      else if(typeof value !== "function" || /^[A-Z]/.test(key)){
        state[key] = value;
        defineProperty(subject, key, {
          enumerable: true,
          get: () => state[key],
          set: this.setter(key, handler)
        });
      }
    }
  }

  public setter(
    key: string,
    handler?: Controller.OnValue){

    const { state, subject } = this;

    return (value: any) => {
      if(state[key] == value)
        return;

      if(handler)
        switch(handler.call(subject, value, state)){
          case true:
            this.update(key);
          case false:
            return;
        }

      this.update(key, value);
    }
  }

  public addListener(listener: Controller.Listen){
    this.followers.add(listener);
    return () => {
      this.followers.delete(listener)
    }
  }

  public update(key: string, value?: any){
    if(1 in arguments)
      this.state[key] = value;

    if(this.frame.has(key))
      return;

    if(!this.frame.size)
      setTimeout(() => {
        Computed.flush(this);

        const keys = Object.freeze([ ...this.frame ]);
        const handle = new Set(this.waiting);

        this.waiting.clear();
        this.frame.clear();

        UPDATE.set(this.subject, keys);

        setTimeout(() => {
          UPDATE.delete(this.subject);
        }, 0);

        handle.forEach(callback => {
          try { callback(keys) }
          catch(e){ }
        })
      }, 0);

    this.frame.add(key);

    for(const callback of this.followers){
      const event = callback(key, this);

      if(typeof event == "function")
        this.waiting.add(event);
    }
  }

  public requestUpdate(arg?: boolean | RequestCallback): any {
    if(typeof arg == "function"){
      this.waiting.add(arg);
      return;
    }

    if(typeof arg == "boolean" && arg !== this.frame.size > 0)
      return Promise.reject(Oops.StrictUpdate(arg));

    return <PromiseLike<readonly string[] | false>> {
      then: (callback) => {
        if(callback)
          if(this.frame.size)
            this.waiting.add(callback);
          else
            callback(false);
        else
          throw Oops.NoChaining();
      }
    }
  }
}

type EnsureCallback = (control: Controller) => Callback | void;

export function control(subject: Stateful): Controller;
export function control(subject: Stateful, cb: EnsureCallback): Callback;
export function control(subject: Stateful, cb?: EnsureCallback){
  const control = subject[CONTROL];

  if(!cb){
    if(!control.state)
      control.start();

    return control;
  }

  if(!control.state){
    let done: Callback | void;

    control.requestUpdate(() => {
      done = cb(control);
    });

    return () => done && done();
  }

  return cb(control);
}

export { Controller }