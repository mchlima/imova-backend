import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ContactsService } from './contacts.service'
import { UpdateContactDto } from './dto/update-contact.dto'
import { CreateContactDto } from './dto/create-contact.dto'
import { CreateChannelDto } from './dto/create-channel.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { RequirePermissions } from '../auth/require-permissions.decorator'

@Controller('contacts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  @RequirePermissions('contacts:read')
  findAll() {
    return this.contacts.findAll()
  }

  @Post()
  @RequirePermissions('contacts:write')
  create(@Body() dto: CreateContactDto) {
    return this.contacts.create(dto)
  }

  @Get(':id')
  @RequirePermissions('contacts:read')
  findOne(@Param('id') id: string) {
    return this.contacts.findOne(id)
  }

  @Patch(':id')
  @RequirePermissions('contacts:write')
  update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contacts.update(id, dto)
  }

  // ── formas de contato (channels) ──
  @Post(':id/channels')
  @RequirePermissions('contacts:write')
  addChannel(@Param('id') id: string, @Body() dto: CreateChannelDto) {
    return this.contacts.addChannel(id, dto)
  }

  @Delete(':id/channels/:channelId')
  @RequirePermissions('contacts:write')
  removeChannel(@Param('id') id: string, @Param('channelId') channelId: string) {
    return this.contacts.removeChannel(id, channelId)
  }
}
