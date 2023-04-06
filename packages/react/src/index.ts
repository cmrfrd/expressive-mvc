import { Model } from '@expressive/mvc';

import { hasContext, useContext } from './useContext';
import { useModel } from './useModel';

Model.has = hasContext;
Model.get = useContext;
Model.use = useModel;

export {
  default,
  Model,
  Debug,
  add,
  ref,
  run,
  set,
  use,
  get
} from '@expressive/mvc';

export { Consumer } from "./consumer";
export { Provider } from "./provider";