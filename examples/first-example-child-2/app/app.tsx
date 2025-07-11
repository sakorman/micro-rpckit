import { MessageService } from '@example/first-example-decl';
import { Button, Row } from 'antd';
import React from 'react';
import { sappSDK } from 'rpckit';

export function App() {

    const showMessage = async () => {
        const message = await sappSDK.getService(MessageService);
        await message!.info('点击弹出成功！');
    };

    return (
        <Row>
            <Button onClick={showMessage}>弹出提示信息！</Button>
        </Row>
    );
}
