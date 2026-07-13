import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ContactsService } from './contacts.service'
import { UpdateContactDto } from './dto/update-contact.dto'
import { CreateContactDto } from './dto/create-contact.dto'
import { CreateChannelDto } from './dto/create-channel.dto'
import { DeleteContactsDto } from './dto/delete-contacts.dto'
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

  // ── exclusão ──
  // Prévia do estrago: quantas oportunidades e documentos sairiam junto. A UI mostra
  // isso na confirmação, então ninguém apaga o histórico sem saber.
  @Post('deletion-impact')
  @HttpCode(200)
  @RequirePermissions('contacts:delete')
  deletionImpact(@Body() dto: DeleteContactsDto) {
    return this.contacts.deletionImpact(dto.ids)
  }

  // Em massa. Vem como POST porque DELETE com corpo não é confiável entre proxies.
  @Post('bulk-delete')
  @HttpCode(200)
  @RequirePermissions('contacts:delete')
  removeMany(@Body() dto: DeleteContactsDto) {
    return this.contacts.removeMany(dto.ids)
  }

  @Delete(':id')
  @RequirePermissions('contacts:delete')
  remove(@Param('id') id: string) {
    return this.contacts.remove(id)
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
