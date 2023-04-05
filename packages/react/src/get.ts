import { issues, Model, Context } from '@expressive/mvc';

import { useAmbient } from './provider';

export const Oops = issues({
  AmbientRequired: (requested, requester) =>
    `Attempted to find an instance of ${requested} in context. It is required by ${requester}, but one could not be found.`
});

const Pending = new WeakMap<{}, ((context: Context) => void)[]>();
const Applied = new WeakMap<Model, boolean>();

function getPeerContext<T extends Model>(
  type: Model.Type<T>,
  callback: (got: T) => void,
  required: boolean | undefined,
  from: Model
){
  let pending = Pending.get(from);
  
  if(!pending)
    Pending.set(from, pending = []);

  pending.push(context => {
    const got = context.get<T>(type, false);

    if(got)
      callback(got);
    else if(required)
      throw Oops.AmbientRequired(type, from);
  })
}

function usePeerContext(subject: Model){
  if(Applied.has(subject)){
    if(Applied.get(subject))
      useAmbient();

    return;
  }

  const pending = Pending.get(subject);

  if(pending){
    const local = useAmbient();

    for(const init of pending)
      init(local);

    Pending.delete(subject);
  }

  Applied.set(subject, !!pending);
}

function setPeers(context: Context, onto: Model){
  const pending = Pending.get(onto);

  if(pending)
    pending.forEach(cb => cb(context));
}

export {
  getPeerContext,
  usePeerContext,
  setPeers
}