import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { FixedSizeList } from 'react-window';
import * as ql from './wasm-ql';

require('./style.css');

class AppState {
    public alive = true;
    public clientRoot: ClientRoot;
    public result = [];
    public chainWasm = new ql.ClientWasm('./chain-client.wasm');
    public tokenWasm = new ql.ClientWasm('./token-client.wasm');
    public request = 0;
    public more = null;

    private run(wasm, query, args, firstKeyName, handle) {
        this.result = [];
        this.clientRoot.forceUpdate();
        const thisRequest = ++this.request;
        let first_key = args[firstKeyName];
        let running = false;
        this.more = async () => {
            if (running)
                return;
            running = true;
            const reply = await wasm.round_trip([
                query,
                { ...args, max_block: ['head', args.max_block], [firstKeyName]: first_key },
            ]);
            if (thisRequest !== this.request)
                return;
            running = false;
            handle(reply[1]);
            first_key = reply[1].more;
            if (!first_key)
                this.more = null;
            this.clientRoot.forceUpdate();
        };
    }

    public runSelected() {
        this.selection.run();
    }

    public accountsArgs = {
        max_block: 50000000,
        first: '',
        last: 'zzzzzzzzzzzzj',
        include_abi: true,
        max_results: 10,
    };
    public run_accounts() {
        this.run(this.chainWasm, 'account', this.accountsArgs, 'first', reply => {
            for (let acc of reply.accounts) {
                acc = (({ name, privileged, account_creation_date, code, last_code_update, account_abi }) =>
                    ({ name, privileged, account_creation_date, code, last_code_update, abi: account_abi }))(acc);
                this.result.push(...JSON.stringify(acc, (k, v) => {
                    if (k === 'abi') {
                        if (v.length <= 66)
                            return v;
                        else
                            return v.substr(0, 64) + '... (' + (v.length / 2) + ' bytes)';
                    } else
                        return v;
                }, 4).split('\n'));
            }
        });
    }
    public accounts = { run: this.run_accounts.bind(this), form: AccountsForm };

    public multTokensArgs = {
        max_block: 50000000,
        account: 'b1',
        first_key: { sym: '', code: '' },
        last_key: { sym: 'ZZZZZZZ', code: 'zzzzzzzzzzzzj' },
        max_results: 100,
    };
    public run_mult_tokens() {
        this.run(this.tokenWasm, 'bal.mult.tok', this.multTokensArgs, 'first_key', reply => {
            for (const balance of reply.balances)
                this.result.push(balance.account.padEnd(13, ' ') + ql.format_extended_asset(balance.amount));
        });
    }
    public multipleTokens = { run: this.run_mult_tokens.bind(this), form: MultipleTokensForm };

    public tokensMultAccArgs = {
        max_block: 50000000,
        code: 'eosio.token',
        sym: 'EOS',
        first_account: '',
        last_account: 'zzzzzzzzzzzzj',
        max_results: 100,
    };
    public run_tok_mul_acc() {
        this.run(this.tokenWasm, 'bal.mult.acc', this.tokensMultAccArgs, 'first_account', reply => {
            for (const balance of reply.balances)
                this.result.push(balance.account.padEnd(13, ' ') + ql.format_extended_asset(balance.amount));
        });
    }
    public tokensMultAcc = { run: this.run_tok_mul_acc.bind(this), form: TokensForMultipleAccountsForm };

    public transfersArgs = {
        max_block: 50000000,
        first_key: {
            receiver: '',
            account: '',
            block: ['absolute', 0],
            transaction_id: '0000000000000000000000000000000000000000000000000000000000000000',
            action_ordinal: 0,
        },
        last_key: {
            receiver: 'zzzzzzzzzzzzj',
            account: 'zzzzzzzzzzzzj',
            block: ['absolute', 999999999],
            transaction_id: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
            action_ordinal: 0xffffffff,
        },
        include_notify_incoming: true,
        include_notify_outgoing: true,
        max_results: 100,
    };
    public run_transfers() {
        this.run(this.tokenWasm, 'transfer', this.transfersArgs, 'first_key', reply => {
            for (const transfer of reply.transfers)
                this.result.push(
                    transfer.from.padEnd(13, ' ') + ' -> ' + transfer.to.padEnd(13, ' ') +
                    ql.format_extended_asset(transfer.quantity) + '     ' + transfer.memo);
        });
    }
    public transfers = { run: this.run_transfers.bind(this), form: TransfersForm };

    public selection = this.accounts;

    public restore(prev: AppState) {
        prev.request = -1;
        this.result = prev.result;
        this.accountsArgs = prev.accountsArgs;
        this.multTokensArgs = prev.multTokensArgs;
        this.tokensMultAccArgs = prev.tokensMultAccArgs;
        this.transfersArgs = prev.transfersArgs;
    }
}

async function delay(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    });
}

function Results({ appState }: { appState: AppState }) {
    const FSL = FixedSizeList as any;
    return (
        <div className='result'>
            <FSL
                itemCount={appState.result.length + (appState.more ? 10 : 0)}
                itemSize={16}
                height={800}
            >
                {({ index, style }) => {
                    let content;
                    if (index < appState.result.length) {
                        content = appState.result[index];
                    } else {
                        content = 'Loading...';
                        if (appState.more) appState.more();
                    }
                    return <pre style={style}>{content}</pre>;
                }}
            </FSL>
        </div>
    );
}

function AccountsForm({ appState }: { appState: AppState }) {
    return (
        <div className='balance'>
            <table>
                <tbody>
                    <tr>
                        <td>max_block</td>
                        <td></td>
                        <td><input type="text" value={appState.accountsArgs.max_block} onChange={e => { appState.accountsArgs.max_block = +e.target.value; appState.runSelected(); }} /></td>
                    </tr>
                    <tr>
                        <td>first</td>
                        <td></td>
                        <td><input type="text" value={appState.accountsArgs.first} onChange={e => { appState.accountsArgs.first = e.target.value; appState.runSelected(); }} /></td>
                    </tr>
                    <tr>
                        <td>last</td>
                        <td></td>
                        <td><input type="text" value={appState.accountsArgs.last} onChange={e => { appState.accountsArgs.last = e.target.value; appState.runSelected(); }} /></td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

function MultipleTokensForm({ appState }: { appState: AppState }) {
    return (
        <div className='balance'>
            <table>
                <tbody>
                    <tr>
                        <td>max_block</td>
                        <td></td>
                        <td><input type="text" value={appState.multTokensArgs.max_block} onChange={e => { appState.multTokensArgs.max_block = +e.target.value; appState.runSelected(); }} /></td>
                    </tr>
                    <tr>
                        <td>account</td>
                        <td></td>
                        <td><input type="text" value={appState.multTokensArgs.account} onChange={e => { appState.multTokensArgs.account = e.target.value; appState.runSelected(); }} /></td>
                    </tr>
                    <tr>
                        <td>first_key</td>
                        <td>sym</td>
                        <td><input type="text" value={appState.multTokensArgs.first_key.sym} onChange={e => { appState.multTokensArgs.first_key.sym = e.target.value; appState.runSelected(); }} /></td>
                    </tr>
                    <tr>
                        <td></td>
                        <td>code</td>
                        <td><input type="text" value={appState.multTokensArgs.first_key.code} onChange={e => { appState.multTokensArgs.first_key.code = e.target.value; appState.runSelected(); }} /></td>
                    </tr>
                    <tr>
                        <td>last_key</td>
                        <td>sym</td>
                        <td><input type="text" value={appState.multTokensArgs.last_key.sym} onChange={e => { appState.multTokensArgs.last_key.sym = e.target.value; appState.runSelected(); }} /></td>
                    </tr>
                    <tr>
                        <td></td>
                        <td>code</td>
                        <td><input type="text" value={appState.multTokensArgs.last_key.code} onChange={e => { appState.multTokensArgs.last_key.code = e.target.value; appState.runSelected(); }} /></td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

function TokensForMultipleAccountsForm({ appState }: { appState: AppState }) {
    return (
        <div className='balance'>
            <table>
                <tbody>
                    <tr>
                        <td>max_block</td>
                        <td></td>
                        <td><input type="text" value={appState.tokensMultAccArgs.max_block} onChange={e => { appState.tokensMultAccArgs.max_block = +e.target.value; appState.runSelected(); }} /></td>
                    </tr>
                    <tr>
                        <td>code</td>
                        <td></td>
                        <td><input type="text" value={appState.tokensMultAccArgs.code} onChange={e => { appState.tokensMultAccArgs.code = e.target.value; appState.runSelected(); }} /></td>
                    </tr>
                    <tr>
                        <td>sym</td>
                        <td></td>
                        <td><input type="text" value={appState.tokensMultAccArgs.sym} onChange={e => { appState.tokensMultAccArgs.sym = e.target.value; appState.runSelected(); }} /></td>
                    </tr>
                    <tr>
                        <td>first_account</td>
                        <td></td>
                        <td><input type="text" value={appState.tokensMultAccArgs.first_account} onChange={e => { appState.tokensMultAccArgs.first_account = e.target.value; appState.runSelected(); }} /></td>
                    </tr>
                    <tr>
                        <td>last_account</td>
                        <td></td>
                        <td><input type="text" value={appState.tokensMultAccArgs.last_account} onChange={e => { appState.tokensMultAccArgs.last_account = e.target.value; appState.runSelected(); }} /></td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

function TransfersForm({ appState }: { appState: AppState }) {
    return (
        <div className='balance'>
            <table>
                <tbody>
                    <tr>
                        <td>max_block</td>
                        <td></td>
                        <td><input type="text" value={appState.transfersArgs.max_block} onChange={e => { appState.transfersArgs.max_block = +e.target.value; appState.runSelected(); }} /></td>
                    </tr>
                    <tr>
                        <td>first_receiver</td>
                        <td></td>
                        <td><input type="text" value={appState.transfersArgs.first_key.receiver} onChange={e => { appState.transfersArgs.first_key.receiver = e.target.value; appState.runSelected(); }} /></td>
                    </tr>
                    <tr>
                        <td>last_receiver</td>
                        <td></td>
                        <td><input type="text" value={appState.transfersArgs.last_key.receiver} onChange={e => { appState.transfersArgs.last_key.receiver = e.target.value; appState.runSelected(); }} /></td>
                    </tr>
                    <tr>
                        <td>incoming</td>
                        <td></td>
                        <td><input type="checkbox" checked={appState.transfersArgs.include_notify_incoming} onChange={e => { appState.transfersArgs.include_notify_incoming = e.target.checked; appState.runSelected(); }} /></td>
                    </tr>
                    <tr>
                        <td>outgoing</td>
                        <td></td>
                        <td><input type="checkbox" checked={appState.transfersArgs.include_notify_outgoing} onChange={e => { appState.transfersArgs.include_notify_outgoing = e.target.checked; appState.runSelected(); }} /></td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

function Controls({ appState }: { appState: AppState }) {
    return (
        <div className='control'>
            <label>
                <input
                    type="radio"
                    checked={appState.selection === appState.accounts}
                    onChange={e => { appState.selection = appState.accounts; appState.runSelected(); }}>
                </input>
                Accounts
            </label>
            <label>
                <input
                    type="radio"
                    checked={appState.selection === appState.multipleTokens}
                    onChange={e => { appState.selection = appState.multipleTokens; appState.runSelected(); }}>
                </input>
                Multiple Tokens
            </label>
            <label>
                <input
                    type="radio"
                    checked={appState.selection === appState.tokensMultAcc}
                    onChange={e => { appState.selection = appState.tokensMultAcc; appState.runSelected(); }}>
                </input>
                Tokens For Mult Acc
            </label>
            <label>
                <input
                    type="radio"
                    checked={appState.selection === appState.transfers}
                    onChange={e => { appState.selection = appState.transfers; appState.runSelected(); }}>
                </input>
                Transfers
            </label>
        </div>
    );
}

class ClientRoot extends React.Component<{ appState: AppState }> {
    public render() {
        const { appState } = this.props;
        appState.clientRoot = this;
        return (
            <div className='client-root'>
                <div className='banner'>
                    Example application demonstrating wasm-ql
                </div>
                <Controls appState={appState} />
                {appState.selection.form({ appState })}
                <Results appState={appState} />
                <div className='disclaimer'>
                    <a href="https://github.com/EOSIO/history-tools">GitHub Repo...</a>
                </div>
            </div>
        );
    }
}

export default function init(prev: AppState) {
    let appState = new AppState();
    if (prev) {
        appState.restore(prev);
        prev.alive = false;
    }
    ReactDOM.render(<ClientRoot {...{ appState }} />, document.getElementById('main'));
    return appState;
}
