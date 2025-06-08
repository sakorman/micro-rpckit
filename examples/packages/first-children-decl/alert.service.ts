import { anno, API_UNSUPPORT, ServAPIRetn, ServService } from 'rpckit';

@anno.decl({
    id: 'com.example.child.alert.service',
    version: '1.0.0',
})
export class AlertService extends ServService {

    @anno.decl.api()
    alert(message: string): ServAPIRetn<void> {
        return API_UNSUPPORT();
    }
}
