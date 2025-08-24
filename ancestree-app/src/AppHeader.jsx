import React from 'react';
import { appConfig } from './config';

const AppHeader = () => {
  return (
    <article className="container" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      padding: '5px 10px',
      margin: 0
    }}>
      <h1 style={{ 
        margin: '0 0 5px 0', 
        fontSize: '2rem',
        lineHeight: '1.2'
      }}>
        {appConfig.header.title}
      </h1>
      <p style={{ 
        margin: '0 0 3px 0', 
        fontSize: '0.9rem',
        lineHeight: '1.2'
      }}>
        {appConfig.header.subtitle}
      </p>
      <p style={{ 
        margin: '0', 
        fontSize: '0.8rem',
        lineHeight: '1.2',
        opacity: 0.8
      }}>
        {appConfig.header.description}
      </p>
    </article>
  );
};

export default AppHeader;
