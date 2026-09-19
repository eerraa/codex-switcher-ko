import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { AddAccountModal } from '../../src/components/AddAccountModal';
import { AccountList } from '../../src/components/AccountList';
import { TrayPopup } from '../../src/components/TrayPopup';
import { Proxy } from '../../src/components/Proxy';
import { account, settings } from './windows-ipc.mjs';
import '../../src/App.css';

function Fixture() {
    const [open, setOpen] = useState(true);
    const view = new URLSearchParams(location.search).get('view');
    if (view === 'tray') return <TrayPopup />;
    if (view === 'proxy') return <Proxy />;
    if (view === 'accounts') return <AccountList accounts={[account]} currentId={account.id} settings={settings}
        onSwitch={async () => {}} onDelete={async () => {}} onUpdateAccount={async () => {}}
        onUpdateSettings={async () => {}} />;
    return <><button id="fixture-open" onClick={() => setOpen(true)}>Open fixture</button>
        <AddAccountModal isOpen={open} onClose={() => setOpen(false)} onAdd={async () => {}} /></>;
}
ReactDOM.createRoot(document.getElementById('root')!).render(<Fixture />);
