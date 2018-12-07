// Copyright 2017-2018 @polkadot/app-storage authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { StorageFunction } from '@polkadot/types/StorageKey';
import { I18nProps } from '@polkadot/ui-app/types';
import { RawParam } from '@polkadot/ui-app/Params/types';
import { QueryTypes, StorageModuleQuery } from './types';

import React from 'react';
import { Compact } from '@polkadot/types/codec';
import { Button, Labelled } from '@polkadot/ui-app/index';
import valueToText from '@polkadot/ui-app/Params/valueToText';
import { withObservableDiv } from '@polkadot/ui-react-rx/with/index';
import { isU8a, u8aToBn, u8aToHex, u8aToString } from '@polkadot/util';

import translate from './translate';
import { RenderFn, DefaultProps, ComponentRenderer } from '@polkadot/ui-react-rx/with/types';

type Props = I18nProps & {
  onRemove: (id: number) => void,
  value: QueryTypes
};

type ComponentProps = {};

type State = {
  inputs: Array<React.ReactNode>,
  Component: React.ComponentType<ComponentProps>,
  spread: { [index: number]: boolean }
};

type CacheInstance = {
  Component: React.ComponentType<any>,
  render: RenderFn,
  refresh: (swallowErrors: boolean, contentShorten: boolean) => React.ComponentType<any>
};

const cache: Array<CacheInstance> = [];

enum StorageQueryParameter {
  Single = 1,
  Tuple // tuple with two or more elements
}

const formatValueForKey = function (key: StorageFunction, value: any): any {
  // Convert tothe key entered by the user to hex for comparison against possible keys
  const keyAsHex = u8aToHex(key);

  // :code
  const codeAsHex = u8aToHex(new Uint8Array([20, 58, 99, 111, 100, 101]));
  // :heappages
  const heappagesAsHex = u8aToHex(new Uint8Array([40, 58, 104, 101, 97, 112, 112, 97, 103, 101, 115]));
  // :auth:len
  const authLenAsHex = u8aToHex(new Uint8Array([36, 58, 97, 117, 116, 104, 58, 108, 101, 110]));
  // :auth:
  const authAsHex = u8aToHex(new Uint8Array([24, 58, 97, 117, 116, 104, 58]));
  // :extrinsic_index
  const extrinsicIndexAsHex = u8aToHex(new Uint8Array([64, 58, 101, 120, 116, 114, 105, 110, 115, 105, 99, 95, 105, 110, 100, 101, 120]));
  // :changes_trie
  const changesTrieAsHex = u8aToHex(new Uint8Array([52, 58, 99, 104, 97, 110, 103, 101, 115, 95, 116, 114, 105, 101]));

  switch (keyAsHex) {
    case codeAsHex: // :code
      console.log(':code');
      break;
    case heappagesAsHex: // :heappages
      console.log(':heappages');
      break;
    case authLenAsHex: // :auth:len
      console.log(':auth:len');
      // value = value ? u8aToBn(value, true).toString() : value;
      // console.log('converted: ', value);
      break;
    case authAsHex: // :auth:
      console.log(':auth:');
      break;
    case extrinsicIndexAsHex: // :extrinsic_index
      console.log(':extrinsic_index');
      break;
    case changesTrieAsHex: // :changes_trie
      console.log(':changes_trie');
      break;
    default:
      break;
  }

  return value;
};

const generateDisplayParams = function (params: RawParam[]): Array<React.ReactNode> {
  const inputs: Array<React.ReactNode> = [];

  params && params.forEach(function (param, index) {
    const paramsLength = params.length;

    // skip the function parameter if it is invalid, the `info` (amount of elements in the tuple)
    // are unknown, or if the type `type` is unknown type
    if (!param.isValid || !param.info || !param.type) {
      inputs.push(<span key={`param_unknown`}>unknown</span>);
      return;
    }

    // Case 1: single parameter
    if (param.info === StorageQueryParameter.Single) {
      inputs.push(
        <span key={`param_${param.type}`}>
          {param.type}={valueToText(param.type, param.value)}{index !== paramsLength - 1 ? ', ' : ''}
        </span>
      );
    }

    // Case 2: tuple with two or more elements
    if (param.info && param.info >= StorageQueryParameter.Tuple && param.sub && param.sub.length === param.info) {
      const subs: Function = (param: RawParam): Array<React.ReactNode> | [] => {
        if (!param.sub) {
          return [];
        }

        return param.sub.map((el, i) =>
          el && valueToText(el.type, param.value[i])
        );
      };

      const start: Function = (index: number) =>
        param.sub && index === 0 ? '(' : '';

      const end: Function = (index: number) =>
        param.sub && index !== param.sub.length - 1 ? ', ' : ')';

      const contents = subs(param).map((el: React.ReactNode, i: number) =>
        <span>{start(i)}{el}{end(i)}</span>
      );

      inputs.push(<span key={`param_${param.type}`}>{param.type}={contents}</span>);
    }
  });

  return inputs;
};

class Query extends React.PureComponent<Props, State> {
  state: State = { spread: {} } as State;

  static getCachedComponent (query: QueryTypes): CacheInstance {
    const { id, key, params = [] } = query as StorageModuleQuery;

    console.log('getCachedComponent id, key, params: ', id, key, params);
    console.log('cache[id]: ', cache[id]);

    if (!cache[id]) {
      const values: Array<any> = params.map(({ value }) => value);
      console.log('no cache with: values: ', values);
      const type = key.meta
        ? key.meta.type.toString()
        : 'Data';
      const defaultProps = { className: 'ui--output' };

      // render function to create an element for the query results which is plugged to the api
      console.log('[key, ...values]: ', [key, ...values]);
      const fetchAndRenderHelper = withObservableDiv('rawStorage', { params: [key, ...values] });
      const pluggedComponent = fetchAndRenderHelper(
        // By default we render a simple div node component with the query results in it
        (value: any) => {
          console.log('type, value: ', type, value);
          // console.log('valueToText(type, value, true, true): ', valueToText(type, value, true, true));

          // change the format of the value depending on its key
          value = value && formatValueForKey(key, value);
          return valueToText(type, value, true, true);
        },
        defaultProps
      );
      cache[query.id] = Query.createComponentCacheInstance(type, pluggedComponent, defaultProps, fetchAndRenderHelper);
    }

    return cache[id];
  }

  static createComponentCacheInstance (type: string, pluggedComponent: React.ComponentType<any>, defaultProps: DefaultProps<any>, fetchAndRenderHelper: ComponentRenderer<any>) {
    return {
      Component: pluggedComponent,
      // In order to replace the default component during runtime we can provide a RenderFn to create a new 'plugged' component
      render: (createComponent: RenderFn) => {
        return fetchAndRenderHelper(
          createComponent,
          defaultProps
        );
      },
      // In order to modify the parameters which are used to render the default component, we can use this method
      refresh: (swallowErrors: boolean, contentShorten: boolean) => {
        return fetchAndRenderHelper(
          (value: any) => valueToText(type, value, swallowErrors, contentShorten),
          defaultProps
        );
      }
    };
  }

  static getDerivedStateFromProps ({ value }: Props, prevState: State): State | null {
    const Component = Query.getCachedComponent(value).Component;
    const { params } = value as StorageModuleQuery;
    const inputs: Array<React.ReactNode> = generateDisplayParams(params);

    return {
      Component,
      inputs
    } as State;
  }

  render () {
    const { value } = this.props;
    const { Component } = this.state;
    const { key } = value;

    console.log('Component: ', Component);
    console.log('value: ', value);

    return (
      <div className='storage--Query storage--actionrow'>
        <Labelled
          className='storage--actionrow-value'
          label={
            <div className='ui--Param-text'>
              <div className='ui--Param-text name'>{this.keyToName(key)}</div>
              {this.renderInputs()}
              <div className='ui--Param-text'>{
                isU8a(key)
                  ? 'Data'
                  : key.meta.type.toString()
              }</div>
            </div>
          }
        >
          <Component />
        </Labelled>
        <Labelled className='storage--actionrow-buttons'>
          <div className='container'>
            {this.renderButtons()}
          </div>
        </Labelled>
      </div>
    );
  }

  private renderButtons () {
    const { id, key } = this.props.value as StorageModuleQuery;

    const buttons = [
      <Button
        icon='close'
        isNegative
        onClick={this.onRemove}
      />
    ];

    if (key.meta && key.meta.type.toString() === 'Bytes') {
      // TODO We are currently not performing a copy
      // buttons.unshift(
      //   <Button
      //     icon='copy'
      //     onClick={this.copyHandler(id)}
      //   />
      // );
      buttons.unshift(
        <Button
          icon='ellipsis horizontal'
          onClick={this.spreadHandler(id)}
        />
      );
    }

    return buttons;
  }

  private renderInputs () {
    const { inputs } = this.state;

    if (inputs.length === 0) {
      return (
        <div className='ui--Param-text name'>:</div>
      );
    }

    return [
      <div key='open' className='ui--Param-text name'>(</div>,
      inputs,
      <div key='close' className='ui--Param-text name'>):</div>
    ];
  }

  private keyToName (key: Uint8Array | StorageFunction): string {
    if (isU8a(key)) {
      const u8a = Compact.stripLengthPrefix(key);
      console.log('u8aToString(u8a): ', u8aToString(u8a));

      // If the string starts with `:`, handle it as a pure string
      return u8a[0] === 0x3a
        ? u8aToString(u8a)
        : u8aToHex(u8a);
    }

    return `${key.section}.${key.method}`;
  }

  private spreadHandler (id: number) {
    return () => {
      const { spread } = this.state;

      cache[id].Component = cache[id].refresh(true, !!spread[id]);
      spread[id] = !spread[id];

      this.setState({
        ...this.state,
        ...spread,
        Component: cache[id].Component
      });
    };
  }

  private onRemove = (): void => {
    const { onRemove, value: { id } } = this.props;

    delete cache[id];

    onRemove(id);
  }
}

export {
  generateDisplayParams
};

export default translate(Query);
