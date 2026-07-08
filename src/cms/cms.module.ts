import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { CategoriesService } from './categories.service'
import { TagsService } from './tags.service'
import { PostsService } from './posts.service'
import { ViewsService } from './views.service'
import { R2Service } from './r2.service'
import {
  AdminCategoriesController,
  AdminTagsController,
  AdminPostsController,
} from './admin.controller'
import { ContentController } from './content.controller'

@Module({
  imports: [AuthModule], // JwtAuthGuard nas rotas /admin/*
  controllers: [
    AdminCategoriesController,
    AdminTagsController,
    AdminPostsController,
    ContentController,
  ],
  providers: [CategoriesService, TagsService, PostsService, ViewsService, R2Service],
})
export class CmsModule {}
