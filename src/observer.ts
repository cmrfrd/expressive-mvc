import { Controllable } from './controller';
import { Model } from './model';
import { Subscriber } from './subscriber';
import {
  alias,
  createEffect,
  debounce,
  defineProperty,
  entriesIn,
  fn,
  getOwnPropertyDescriptor,
  getPrototypeOf,
  insertAfter
} from './util';

import Oops from './issues';

export interface GetterInfo {
  key: string;
  parent: Observer;
  priority: number;
}

/**
 * *Placeholder Type.*
 * 
 * Depending on `squash` parameter, will by default accept
 * value+key or expect no parameters if set to true.
 **/
type EventCallback = Function;
type Init = (key: string, on: Observer) => void;
type InitCompute = (early?: boolean) => void;

const ComputedInfo = new WeakMap<Function, GetterInfo>();
const ComputedInit = new WeakSet<Function>();
const Pending = new WeakSet<Init>();

export function metaData(x: Function): GetterInfo;
export function metaData(x: Function, set: GetterInfo): typeof ComputedInfo;
export function metaData(x: Function, set?: GetterInfo){
  if(set)
    return ComputedInfo.set(x, set);
  else
    return ComputedInfo.get(x);
}

export class Observer {
  protected getters = new Map<string, Callback>();
  protected waiting = [] as RequestCallback[];

  public state = {} as BunchOf<any>;
  public followers = new Set<BunchOf<RequestCallback>>();

  public pending?: (key: string) => void;

  static define(fn: Init){
    Pending.add(fn);
    return fn as any;
  }

  constructor(public subject: Controllable){
    let scan = subject;

    while(scan !== Model && scan.constructor !== Model){
      for(let [key, desc] of entriesIn(scan))
        this.prepareComputed(key, desc);

      scan = getPrototypeOf(scan)
    }
  }

  public start(){
    const expected: (Callback | undefined)[] = [];

    for(const [key, { value, enumerable }] of entriesIn(this.subject))
      if(Pending.has(value))
        value(key, this);
      else if(enumerable && !fn(value) || /^[A-Z]/.test(key))
        this.monitorValue(key, value);

    for(const [key, compute] of this.getters)
      expected.push(
        this.monitorComputed(key, compute)
      );

    expected.forEach(x => x && x());
    this.reset();
  }

  protected prepareComputed(
    key: string,
    { get, set }: PropertyDescriptor){

    if(!get || this.getters.has(key))
      return;

    if(!set)
      set = (value: any) => {
        this.getters.delete(key);
        this.override(key, {
          value,
          configurable: true,
          writable: true
        });
      }

    this.state[key] = undefined;
    this.getters.set(key, get);
    this.override(key, {
      get, set, configurable: true
    });
  }

  public override(key: string, desc: PropertyDescriptor){
    defineProperty(this.subject, key, { enumerable: true, ...desc });
  }

  public monitorValue(
    key: string,
    initial: any,
    effect?: EffectCallback<any, any>){

    this.state[key] = initial;
    this.override(key, {
      get: () => this.state[key],
      set: this.setter(key, effect)
    });
  }

  private monitorComputed(
    key: string, getter: () => any){

    let sub: Subscriber;
    const { state, subject } = this;
    const info = { key, parent: this, priority: 1 };

    const update = (initial?: true) => {
      try {
        const value = getter.call(sub.proxy);

        if(state[key] == value)
          return;

        if(!initial)
          this.update(key);

        return state[key] = value;
      }
      catch(err){
        Oops.ComputeFailed(subject.constructor.name, key, false).warn();
        throw err;
      }
    }

    const create = (early?: boolean) => {
      sub = new Subscriber(subject, debounce(update), info);

      defineProperty(state, key, {
        value: undefined,
        writable: true
      })

      this.override(key, {
        get: () => state[key],
        set: Oops.AssignToGetter(key).warn
      })

      try {
        return update(true);
      }
      catch(e){
        if(early)
          Oops.ComputedEarly(key).warn();

        throw e;
      }
      finally {
        sub.listen();

        for(const key in sub.following){
          const compute = this.getters.get(key);

          if(!compute)
            continue;

          const { priority } = metaData(compute);

          if(info.priority <= priority)
            info.priority = priority + 1;
        }
      }
    }

    alias(create, `new ${key}`);
    alias(update, `try ${key}`);
    alias(getter, `run ${key}`);

    metaData(getter, info);
    ComputedInit.add(create);

    for(const sub of this.followers)
      if(key in sub)
        return create;

    defineProperty(state, key, {
      get: create,
      configurable: true
    })

    this.override(key, {
      get: create,
      set: Oops.AssignToGetter(key).warn
    })
  }

  public setter(
    key: string,
    effect?: EffectCallback<any, any>){

    const callback =
      effect && createEffect(effect);

    return (value: any) => {
      if(this.state[key] == value)
        return;

      this.state[key] = value;

      if(callback)
        callback(value, this.subject);

      this.update(key);
    }
  }

  public watch(
    target: string | string[],
    handler: EventCallback,
    squash?: boolean,
    once?: boolean){

    const keys = ([] as string[]).concat(target);

    const callback = squash
      ? handler.bind(this.subject)
      : (frame: string[]) => {
        for(const key of frame)
          if(keys.includes(key))
            handler.call(this.subject, this.state[key], key);
      }

    return this.addListener(keys, callback, once);
  }

  public addListener(
    keys: Iterable<string>,
    callback: RequestCallback,
    once?: boolean){

    const remove = () => { this.followers.delete(follow) };
    const handler = once ? (k?: string[]) => { remove(); callback(k) } : callback;
    const follow: BunchOf<RequestCallback> = {};

    for(const key of keys){
      const desc = getOwnPropertyDescriptor(this.subject, key);
      const getter = desc && desc.get;

      if(ComputedInit.has(getter!))
        (getter as InitCompute)(true);

      follow[key] = handler;
    }

    this.followers.add(follow);

    return remove;
  }

  public update(key: string){
    (this.pending || this.sync())(key);
  }

  private reset(frame?: string[]){
    this.waiting.splice(0).forEach(x => x(frame));
  }

  private sync(){
    const local = this;
    const effects = new Set<RequestCallback>();
    const handled = new Set<string>();
    const pending = [] as Callback[];

    function add(key: string){
      if(handled.has(key))
        return;

      handled.add(key);

      for(const subscription of local.followers)
        if(key in subscription){
          const request = subscription[key];
          const compute = metaData(request);
    
          if(!compute)
            effects.add(request);
          else if(compute.parent !== local)
            request();
          else
            insertAfter(pending, request,
              sib => compute.priority > metaData(sib).priority
            )
        }
    }

    function send(){
      while(pending.length){
        const compute = pending.shift()!;
        const { key } = metaData(compute);

        if(!handled.has(key))
          compute();
      }

      const frame = Array.from(handled);

      effects.forEach(x => x(frame));

      local.pending = undefined;
      local.reset(frame);
    }

    setTimeout(send, 0);
    return this.pending = add;
  }
}