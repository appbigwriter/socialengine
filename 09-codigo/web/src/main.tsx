import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './style.css';

class ErrorBoundary extends React.Component<{children:React.ReactNode},{error:boolean}>{
  state={error:false};
  static getDerivedStateFromError(){return {error:true};}
  render(){return this.state.error?<main className="login"><h1>Não foi possível exibir o painel.</h1><p>Recarregue a página para recuperar sua sessão.</p><button onClick={()=>location.reload()}>Recarregar</button></main>:this.props.children;}
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>);
