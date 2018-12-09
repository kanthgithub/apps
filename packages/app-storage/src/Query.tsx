// Copyright 2017-2018 @polkadot/app-storage authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { StorageFunction } from '@polkadot/types/StorageKey';
import { TypeDef, TypeDefInfo } from '@polkadot/types/codec/createType';
import { I18nProps } from '@polkadot/ui-app/types';
import { RawParam } from '@polkadot/ui-app/Params/types';
import { StorageModuleQuery, QueryTypes } from './types';

import React from 'react';
import { Compact } from '@polkadot/types/codec';
import { Button, Labelled } from '@polkadot/ui-app/index';
import valueToText from '@polkadot/ui-app/Params/valueToText';
import { withObservableDiv } from '@polkadot/ui-react-rx/with/index';
import { isU8a, u8aToHex, u8aToString } from '@polkadot/util';

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

const generatePlain = function (param: RawParam, index: number, paramsLength: number): React.ReactNode {
  const paramType = (param.typeDef as TypeDef).type;

  return (
    <span key={`param_${index}`}>
      {paramType}={valueToText(paramType, param.value)}{index !== paramsLength - 1 ? ', ' : ''}
    </span>
  );
};

const generateTuple = function (param: RawParam, index: number): React.ReactNode {
  const paramType = (param.typeDef as TypeDef).type;
  const paramSubArray = (param.typeDef as TypeDef).sub as TypeDef[];

  const subs = (param: RawParam): Array<React.ReactNode> => {
    return paramSubArray.map((el, i) =>
      el && valueToText(el.type, param.value[i])
    );
  };

  const start = (index: number) =>
    index === 0 ? '(' : '';

  const end = (index: number) =>
    index !== paramSubArray.length - 1 ? ', ' : ')';

  const contents = subs(param).map((el: React.ReactNode, i: number) =>
    <span>{start(i)}{el}{end(i)}</span>
  );

  return <span key={`param_${index}`}>{paramType}={contents}</span>;
};

const generateDisplayParams = function (params: RawParam[]): Array<React.ReactNode> {
  const inputs: Array<React.ReactNode> = [];

  params && params.forEach(function (param, index) {
    const paramInfo = (param.typeDef as TypeDef).info;
    const paramType = (param.typeDef as TypeDef).type;
    const paramSubArray = (param.typeDef as TypeDef).sub as TypeDef[];
    const paramsLength = params.length;

    // skip the function parameter if it is invalid, the `info` (amount of elements in the tuple)
    // are unknown, or if the type `type` is unknown type
    if (!param.isValid || !paramInfo || !paramType) {
      inputs.push(<span key={`param_${index}_unknown`}>unknown</span>);
      return;
    }

    // Plain single parameter
    if (paramInfo && paramInfo === TypeDefInfo.Plain) {
      inputs.push(generatePlain(param, index, paramsLength));
    }

    // Tuple (where `sub` is an array)
    if (paramInfo && paramInfo === TypeDefInfo.Tuple && paramSubArray && paramSubArray.length) {
      inputs.push(generateTuple(param, index));
    }
  });

  return inputs;
};

class Query extends React.PureComponent<Props, State> {
  state: State = { spread: {} } as State;

  static getCachedComponent (query: QueryTypes): CacheInstance {
    const { id, key, params = [] } = query as StorageModuleQuery;

    if (!cache[id]) {
      const values: Array<any> = params.map(({ value }) => value);
      const type = key.meta
        ? key.meta.type.toString()
        : 'Data';
      const defaultProps = { className: 'ui--output' };

      // render function to create an element for the query results which is plugged to the api
      const fetchAndRenderHelper = withObservableDiv('rawStorage', { params: [key, ...values] });
      const pluggedComponent = fetchAndRenderHelper(
        // By default we render a simple div node component with the query results in it
        (value: any) => valueToText(type, value, true, true),
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
