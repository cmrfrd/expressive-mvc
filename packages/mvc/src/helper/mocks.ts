import { Control } from "../control";
import { Model } from "../model";

const newModel = Model.new;

type Callback = () => void;

let current: Model | undefined;
let mount: (() => typeof unmount) | void;
let render: Callback | undefined;
let unmount: Callback | void;

afterEach(() => {
  if(unmount)
    unmount();

  current = undefined;
  render = undefined;
  renderGet = undefined;
  renderTap = undefined;
  renderUse = undefined;
  unmount = undefined;
})

Model.new = function(){
  return current = newModel.call(this);
}

let renderTap: (() => any) | undefined;

Control.tapModel = (Type, memo) => {
  if(!renderTap){
    const value = memo(current);
    renderTap = () => value;
  }

  return renderTap();
}

Control.hasModel = (Type, subject, callback) => {
  callback(current);
}

let renderGet: (() => any) | undefined;

Control.getModel = (_type, adapter) => {
  if(!renderGet){
    const result = adapter(render!, use => use(current));

    if(!result){
      renderGet = () => null;
      return null;
    }

    renderGet = result.render;
    mount = result.commit;
  }

  return renderGet();
}

let renderUse: ((props: any) => any) | undefined;

Control.useModel = (adapter, props) => {
  if(!renderUse){
    const result = adapter(render!);
    
    mount = result.commit;
    renderUse = result.render;
  }

  return renderUse(props);
}

export function mockHook<T>(fn: () => T){
  let willRender = () => {};

  const result = {
    mock: jest.fn(fn),
    current: undefined as T,
    refresh: Promise.resolve(),
    pending: false,
    unmount(){
      if(unmount)
        unmount();
    }
  }

  render = () => {
    try {
      result.pending = false;
      willRender();
      result.current = result.mock();
    }
    catch(error){
      if(!(error instanceof Promise))
        throw error;

      result.pending = true;
      error.then(render).finally(() => {
        result.pending = false;
      });
    }
    finally {
      result.refresh = new Promise(res => willRender = res);

      if(mount){
        unmount = mount();
        mount = undefined;
      }
    }
  }

  render();

  return result;
}