import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { CategoriesService } from './categories.service'
import { TagsService } from './tags.service'
import { PostsService } from './posts.service'
import { ViewsService } from './views.service'
import { HeartbeatDto, StartViewDto } from './dto/view.dto'

// Público — consumido pelas páginas de guias do site.
@Controller('content')
export class ContentController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly tags: TagsService,
    private readonly posts: PostsService,
    private readonly views: ViewsService,
  ) {}

  @Get('categories')
  categories_() {
    return this.categories.tree()
  }

  @Get('tags')
  tags_() {
    return this.tags.list()
  }

  @Get('posts')
  posts_(
    @Query('category') category?: string,
    @Query('tag') tag?: string,
    @Query('q') q?: string,
  ) {
    return this.posts.listPublished({ category, tag, q })
  }

  @Get('posts/:slug')
  post(@Param('slug') slug: string) {
    return this.posts.getPublishedBySlug(slug)
  }

  // ── analytics (tracking de leitura) ──
  @Post('posts/:slug/view')
  startView(@Param('slug') slug: string, @Body() dto: StartViewDto) {
    return this.views.start(slug, dto)
  }

  @Post('views/:id/heartbeat')
  heartbeat(@Param('id') id: string, @Body() dto: HeartbeatDto) {
    return this.views.heartbeat(id, dto)
  }
}
