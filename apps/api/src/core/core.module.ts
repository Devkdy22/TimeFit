import { Global, Module } from '@nestjs/common';
import { EventBus } from './EventBus';

@Global()
@Module({
  providers: [EventBus],
  exports: [EventBus],
})
export class CoreModule {}
