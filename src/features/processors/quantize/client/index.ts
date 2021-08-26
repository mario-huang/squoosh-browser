import { Options as QuantizeOptions } from '../shared/meta';
import {
  inputFieldValueAsNumber,
  konami,
  preventDefault,
} from '../../../../client/lazy-app/util';


const konamiPromise = konami();

interface Props {
  options: QuantizeOptions;
  onChange(newOptions: QuantizeOptions): void;
}

interface State {
  extendedSettings: boolean;
}
