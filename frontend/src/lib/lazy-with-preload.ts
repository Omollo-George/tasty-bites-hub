import React from 'react'

export type PreloadableLazyExoticComponent<T extends React.ComponentType<any>> = React.LazyExoticComponent<T> & {
  preload: () => Promise<{ default: T }>
}

export function lazyWithPreload<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): PreloadableLazyExoticComponent<T> {
  const Component = React.lazy(factory) as PreloadableLazyExoticComponent<T>
  Component.preload = factory
  return Component
}
