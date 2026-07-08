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

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  findAll() {
    return this.contacts.findAll()
  }

  @Post()
  create(@Body() dto: CreateContactDto) {
    return this.contacts.create(dto)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contacts.findOne(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contacts.update(id, dto)
  }

  // ── formas de contato (channels) ──
  @Post(':id/channels')
  addChannel(@Param('id') id: string, @Body() dto: CreateChannelDto) {
    return this.contacts.addChannel(id, dto)
  }

  @Delete(':id/channels/:channelId')
  removeChannel(@Param('id') id: string, @Param('channelId') channelId: string) {
    return this.contacts.removeChannel(id, channelId)
  }
}
