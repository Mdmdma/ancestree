import React from 'react';

const AppHeader = () => {
  return (
    <article className="container" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      padding: '10px' 
    }}>
      <h1>Familie Inntertal</h1>
      <p>Verbindungen über generationen</p>
      <p>Hilf jetzt mit unseren Stammbaum zu vervollständigen</p>
    </article>
  );
};

export default AppHeader;
