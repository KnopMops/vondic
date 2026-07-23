'use client'

import { useState } from 'react'

const ApiDocumentationPage = () => {
	const [activeTab, setActiveTab] = useState('overview')
	const [botikSdkVersion, setBotikSdkVersion] = useState<'0.5.0' | '0.4.2' | '0.4.0' | '0.3.1' | '0.2.0' | '0.1.1'>(
		'0.5.0',
	)

	const tabs = [
		{ id: 'overview', label: 'Обзор' },
		{ id: 'authentication', label: 'Аутентификация' },
		{ id: 'users', label: 'Пользователи' },
		{ id: 'posts', label: 'Посты' },
		{ id: 'messages', label: 'Сообщения' },
		{ id: 'mail', label: 'Почта' },
		{ id: 'comments', label: 'Комментарии' },
		{ id: 'oauth2', label: 'OAuth 2.0' },
		{ id: 'botiksdk', label: 'BotikSDK' },
		{ id: 'vondicapi', label: 'ВондикAPI' },
	]

	const renderContent = () => {
		switch (activeTab) {
			case 'overview':
				return (
					<div className='space-y-6'>
						<section>
							<h2 className='text-2xl font-bold mb-4 text-white'>
								API Социальной Сети Вондик
							</h2>
							<p className='mb-4 text-gray-300'>
								Публичное API социальной сети Вондик. Интеграция с пользователями, постами,
								сообщениями, ботами и другими социальными функциями.
							</p>

							<div className='bg-indigo-500/10 border-l-4 border-indigo-500 p-4 mb-4 backdrop-blur-sm border border-white/10 rounded-lg'>
								<p className='font-semibold text-white'>Базовый URL:</p>
								<code className='bg-gray-800/50 px-2 py-1 rounded text-indigo-300 border border-white/10'>
									https://api.vondic.ru
								</code>
							</div>

							<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
								<div className='border rounded-lg p-4 backdrop-blur-sm border-white/10 bg-white/5'>
									<h3 className='font-bold mb-2 text-white'>v1 API — для сервиса</h3>
									<p className='text-gray-300 text-sm'>Основной API для фронтенда, мобильного приложения и всех внутренних сервисов.</p>
									<p className='text-gray-400 text-xs mt-1'>URL: <code className='text-indigo-300'>/api/v1/</code> и <code className='text-indigo-300'>/api/public/v1/</code></p>
								</div>
								<div className='border rounded-lg p-4 backdrop-blur-sm border-white/10 bg-white/5'>
									<h3 className='font-bold mb-2 text-white'>v2 API — для ботов</h3>
									<p className='text-gray-300 text-sm'>WebSocket, Batch, Analytics, Webhooks, Marketplace — для разработчиков ботов.</p>
									<p className='text-gray-400 text-xs mt-1'>URL: <code className='text-indigo-300'>/api/v2/</code> и <code className='text-indigo-300'>/api/public/v2/</code></p>
								</div>
								<div className='border rounded-lg p-4 backdrop-blur-sm border-white/10 bg-white/5'>
									<h3 className='font-bold mb-2 text-white'>Rate Limits</h3>
									<p className='text-gray-300 text-sm'>v2: Headers X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset</p>
									<p className='text-gray-400 text-xs mt-1'>100 req/min (веб) · 1000 req/min (боты)</p>
								</div>
								<div className='border rounded-lg p-4 backdrop-blur-sm border-white/10 bg-white/5'>
									<h3 className='font-bold mb-2 text-white'>BotikSDK</h3>
									<p className='text-gray-300 text-sm'>Python SDK v0.5.0 — aiogram + WebSocket</p>
									<p className='text-gray-400 text-xs mt-1'>pip install botiksdk==0.5.0</p>
								</div>
							</div>
						</section>
					</div>
				)

			case 'authentication':
				return (
					<div className='space-y-6'>
						<section>
							<h2 className='text-2xl font-bold mb-4 text-white'>
								Аутентификация
							</h2>
							<p className='mb-4 text-gray-300'>
								Все запросы к API требуют аутентификации с использованием API
								ключа. Вы можете сгенерировать свой API ключ в настройках
								аккаунта.
							</p>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Получение API ключа
								</h3>
								<ol className='list-decimal pl-5 space-y-2 text-gray-300'>
									<li>Войдите в ваш аккаунт Вондик</li>
									<li>Перейдите в Настройки &gt; Настройки разработчика</li>
									<li>Нажмите "Сгенерировать API ключ"</li>
									<li>
										Скопируйте сгенерированный ключ и надежно сохраните его
									</li>
								</ol>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Использование вашего API ключа
								</h3>
								<p className='mb-2 text-gray-300'>
									Передавайте API-ключ в заголовке{' '}
									<code className='text-indigo-300'>X-API-Key</code>:
								</p>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`X-API-Key: YOUR_API_KEY`}
								</pre>
							</div>

							<div>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Пример запроса
								</h3>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`curl -X GET \\
  "https://api.vondic.ru/api/public/v2/users/me" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json"`}
								</pre>
							</div>
						</section>
					</div>
				)

			case 'users':
				return (
					<div className='space-y-6'>
						<section>
							<h2 className='text-2xl font-bold mb-4 text-white'>
								API Пользователей
							</h2>
							<p className='mb-4 text-gray-300'>
								Управление профилями пользователей и отношениями через API
								пользователей.
							</p>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Получить всех пользователей
								</h3>
								<div className='bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
									<div className='flex items-center mb-2'>
										<span className='bg-green-500/20 text-green-400 px-2 py-1 rounded mr-2 border border-green-500/30'>
											GET
										</span>
										<code className='text-gray-300'>/users</code>
									</div>
									<p className='mb-2 text-gray-300'>
										Получить постраничный список публичных пользователей.
									</p>
									<div className='mb-2'>
										<strong className='text-white'>
											Параметры запроса (query):
										</strong>
										<ul className='list-disc pl-5 mt-1 text-gray-300'>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													page
												</code>{' '}
												(опционально, по умолчанию: 1) - Номер страницы
											</li>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													limit
												</code>{' '}
												(опционально, по умолчанию: 20) - Количество результатов
												на странице (макс. 100)
											</li>
										</ul>
									</div>
									<div>
										<strong className='text-white'>
											Требуется аутентификация:
										</strong>{' '}
										<span className='text-gray-300'>Нет</span>
									</div>
								</div>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Получить пользователя по ID
								</h3>
								<div className='bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
									<div className='flex items-center mb-2'>
										<span className='bg-green-500/20 text-green-400 px-2 py-1 rounded mr-2 border border-green-500/30'>
											GET
										</span>
										<code className='text-gray-300'>/users/{'{user_id}'}</code>
									</div>
									<p className='mb-2 text-gray-300'>
										Получить публичный профиль конкретного пользователя.
									</p>
									<div>
										<strong className='text-white'>
											Требуется аутентификация:
										</strong>{' '}
										<span className='text-gray-300'>Нет</span>
									</div>
								</div>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Получить текущего пользователя
								</h3>
								<div className='bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
									<div className='flex items-center mb-2'>
										<span className='bg-green-500/20 text-green-400 px-2 py-1 rounded mr-2 border border-green-500/30'>
											GET
										</span>
										<code className='text-gray-300'>/users/me</code>
									</div>
									<p className='mb-2 text-gray-300'>
										Получить профиль аутентифицированного пользователя.
									</p>
									<div>
										<strong className='text-white'>
											Требуется аутентификация:
										</strong>{' '}
										<span className='text-indigo-300'>Да</span>
									</div>
								</div>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Обновить текущего пользователя
								</h3>
								<div className='bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
									<div className='flex items-center mb-2'>
										<span className='bg-blue-500/20 text-blue-400 px-2 py-1 rounded mr-2 border border-blue-500/30'>
											PUT
										</span>
										<code className='text-gray-300'>/users/me</code>
									</div>
									<p className='mb-2 text-gray-300'>
										Обновить профиль аутентифицированного пользователя.
									</p>
									<div className='mb-2'>
										<strong className='text-white'>
											Параметры тела запроса (body):
										</strong>
										<ul className='list-disc pl-5 mt-1 text-gray-300'>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													username
												</code>{' '}
												(опционально) - Новое имя пользователя
											</li>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													first_name
												</code>{' '}
												(опционально) - Имя
											</li>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													last_name
												</code>{' '}
												(опционально) - Фамилия
											</li>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													bio
												</code>{' '}
												(опционально) - Биография/описание
											</li>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													avatar_url
												</code>{' '}
												(опционально) - URL аватара
											</li>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													website
												</code>{' '}
												(опционально) - URL веб-сайта
											</li>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													location
												</code>{' '}
												(опционально) - Местоположение
											</li>
										</ul>
									</div>
									<div>
										<strong className='text-white'>
											Требуется аутентификация:
										</strong>{' '}
										<span className='text-indigo-300'>Да</span>
									</div>
								</div>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Подписаться/Отписаться от пользователей
								</h3>
								<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
									<div className='bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
										<div className='flex items-center mb-2'>
											<span className='bg-blue-500/20 text-blue-400 px-2 py-1 rounded mr-2 border border-blue-500/30'>
												POST
											</span>
											<code className='text-gray-300'>
												/users/{'{user_id}'}/follow
											</code>
										</div>
										<p className='text-gray-300'>Подписаться на пользователя</p>
									</div>
									<div className='bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
										<div className='flex items-center mb-2'>
											<span className='bg-red-500/20 text-red-400 px-2 py-1 rounded mr-2 border border-red-500/30'>
												POST
											</span>
											<code className='text-gray-300'>
												/users/{'{user_id}'}/unfollow
											</code>
										</div>
										<p className='text-gray-300'>Отписаться от пользователя</p>
									</div>
								</div>
							</div>
						</section>
					</div>
				)

			case 'posts':
				return (
					<div className='space-y-6'>
						<section>
							<h2 className='text-2xl font-bold mb-4 text-white'>API Постов</h2>
							<p className='mb-4 text-gray-300'>
								Создание, чтение, обновление и удаление постов через API постов.
							</p>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Получить все посты
								</h3>
								<div className='bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
									<div className='flex items-center mb-2'>
										<span className='bg-green-500/20 text-green-400 px-2 py-1 rounded mr-2 border border-green-500/30'>
											GET
										</span>
										<code className='text-gray-300'>/posts</code>
									</div>
									<p className='mb-2 text-gray-300'>
										Получить постраничный список публичных постов.
									</p>
									<div className='mb-2'>
										<strong className='text-white'>
											Параметры запроса (query):
										</strong>
										<ul className='list-disc pl-5 mt-1 text-gray-300'>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													page
												</code>{' '}
												(опционально, по умолчанию: 1) - Номер страницы
											</li>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													limit
												</code>{' '}
												(опционально, по умолчанию: 20) - Количество результатов
												на странице (макс. 100)
											</li>
										</ul>
									</div>
									<div>
										<strong className='text-white'>
											Требуется аутентификация:
										</strong>{' '}
										<span className='text-gray-300'>Нет</span>
									</div>
								</div>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Создать пост
								</h3>
								<div className='bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
									<div className='flex items-center mb-2'>
										<span className='bg-blue-500/20 text-blue-400 px-2 py-1 rounded mr-2 border border-blue-500/30'>
											POST
										</span>
										<code className='text-gray-300'>/posts</code>
									</div>
									<p className='mb-2 text-gray-300'>Создать новый пост.</p>
									<div className='mb-2'>
										<strong className='text-white'>
											Параметры тела запроса (body):
										</strong>
										<ul className='list-disc pl-5 mt-1 text-gray-300'>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													content
												</code>{' '}
												(обязательно) - Содержание поста
											</li>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													privacy
												</code>{' '}
												(опционально, по умолчанию: "public") - Уровень
												конфиденциальности ("public", "friends", "private")
											</li>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													media_urls
												</code>{' '}
												(опционально) - Массив URL медиафайлов
											</li>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													location
												</code>{' '}
												(опционально) - Информация о местоположении
											</li>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													tags
												</code>{' '}
												(опционально) - Массив тегов
											</li>
										</ul>
									</div>
									<div>
										<strong className='text-white'>
											Требуется аутентификация:
										</strong>{' '}
										<span className='text-indigo-300'>Да</span>
									</div>
								</div>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Получить пост по ID
								</h3>
								<div className='bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
									<div className='flex items-center mb-2'>
										<span className='bg-green-500/20 text-green-400 px-2 py-1 rounded mr-2 border border-green-500/30'>
											GET
										</span>
										<code className='text-gray-300'>/posts/{'{post_id}'}</code>
									</div>
									<p className='mb-2 text-gray-300'>
										Получить конкретный пост.
									</p>
									<div>
										<strong className='text-white'>
											Требуется аутентификация:
										</strong>{' '}
										<span className='text-gray-300'>Нет (если публичный)</span>
									</div>
								</div>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Обновить пост
								</h3>
								<div className='bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
									<div className='flex items-center mb-2'>
										<span className='bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded mr-2 border border-yellow-500/30'>
											PUT
										</span>
										<code className='text-gray-300'>/posts/{'{post_id}'}</code>
									</div>
									<p className='mb-2 text-gray-300'>
										Обновить существующий пост.
									</p>
									<div className='mb-2'>
										<strong className='text-white'>
											Параметры тела запроса (body):
										</strong>
										<ul className='list-disc pl-5 mt-1 text-gray-300'>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													content
												</code>{' '}
												(опционально) - Новое содержание
											</li>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													privacy
												</code>{' '}
												(опционально) - Новый уровень конфиденциальности
											</li>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													media_urls
												</code>{' '}
												(опционально) - Новые URL медиафайлов
											</li>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													location
												</code>{' '}
												(опционально) - Новое местоположение
											</li>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													tags
												</code>{' '}
												(опционально) - Новые теги
											</li>
										</ul>
									</div>
									<div>
										<strong className='text-white'>
											Требуется аутентификация:
										</strong>{' '}
										<span className='text-indigo-300'>
											Да (должен быть владельцем поста)
										</span>
									</div>
								</div>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Удалить пост
								</h3>
								<div className='bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
									<div className='flex items-center mb-2'>
										<span className='bg-red-500/20 text-red-400 px-2 py-1 rounded mr-2 border border-red-500/30'>
											DELETE
										</span>
										<code className='text-gray-300'>/posts/{'{post_id}'}</code>
									</div>
									<p className='text-gray-300'>Удалить пост.</p>
									<div>
										<strong className='text-white'>
											Требуется аутентификация:
										</strong>{' '}
										<span className='text-indigo-300'>
											Да (должен быть владельцем поста)
										</span>
									</div>
								</div>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Лайкнуть/Дизлайкнуть посты
								</h3>
								<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
									<div className='bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
										<div className='flex items-center mb-2'>
											<span className='bg-blue-500/20 text-blue-400 px-2 py-1 rounded mr-2 border border-blue-500/30'>
												POST
											</span>
											<code className='text-gray-300'>
												/posts/{'{post_id}'}/like
											</code>
										</div>
										<p className='text-gray-300'>Поставить лайк посту</p>
									</div>
									<div className='bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
										<div className='flex items-center mb-2'>
											<span className='bg-red-500/20 text-red-400 px-2 py-1 rounded mr-2 border border-red-500/30'>
												POST
											</span>
											<code className='text-gray-300'>
												/posts/{'{post_id}'}/unlike
											</code>
										</div>
										<p className='text-gray-300'>Убрать лайк с поста</p>
									</div>
								</div>
							</div>
						</section>
					</div>
				)

			case 'messages':
				return (
					<div className='space-y-6'>
						<section>
							<h2 className='text-2xl font-bold mb-4 text-white'>
								API Сообщений
							</h2>
							<p className='mb-4 text-gray-300'>
								Отправка и получение личных сообщений через API сообщений.
							</p>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Получить сообщения
								</h3>
								<div className='bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
									<div className='flex items-center mb-2'>
										<span className='bg-green-500/20 text-green-400 px-2 py-1 rounded mr-2 border border-green-500/30'>
											GET
										</span>
										<code className='text-gray-300'>/messages</code>
									</div>
									<p className='mb-2 text-gray-300'>
										Получить сообщения из почтового ящика аутентифицированного
										пользователя.
									</p>
									<div className='mb-2'>
										<strong className='text-white'>
											Параметры запроса (query):
										</strong>
										<ul className='list-disc pl-5 mt-1 text-gray-300'>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													page
												</code>{' '}
												(опционально, по умолчанию: 1) - Номер страницы
											</li>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													limit
												</code>{' '}
												(опционально, по умолчанию: 20) - Количество результатов
												на странице (макс. 100)
											</li>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													thread_with
												</code>{' '}
												(опционально) - Фильтр по конкретному пользователю
											</li>
										</ul>
									</div>
									<div>
										<strong className='text-white'>
											Требуется аутентификация:
										</strong>{' '}
										<span className='text-indigo-300'>Да</span>
									</div>
								</div>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Отправить сообщение
								</h3>
								<div className='bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
									<div className='flex items-center mb-2'>
										<span className='bg-blue-500/20 text-blue-400 px-2 py-1 rounded mr-2 border border-blue-500/30'>
											POST
										</span>
										<code className='text-gray-300'>/messages</code>
									</div>
									<p className='mb-2 text-gray-300'>
										Отправить новое сообщение другому пользователю.
									</p>
									<div className='mb-2'>
										<strong className='text-white'>
											Параметры тела запроса (body):
										</strong>
										<ul className='list-disc pl-5 mt-1 text-gray-300'>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													recipient_id
												</code>{' '}
												(обязательно) - ID получателя
											</li>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													content
												</code>{' '}
												(обязательно) - Содержание сообщения
											</li>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													media_urls
												</code>{' '}
												(опционально) - Массив URL медиафайлов для прикрепления
											</li>
										</ul>
									</div>
									<div>
										<strong className='text-white'>
											Требуется аутентификация:
										</strong>{' '}
										<span className='text-indigo-300'>Да</span>
									</div>
								</div>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Получить переписки
								</h3>
								<div className='bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
									<div className='flex items-center mb-2'>
										<span className='bg-green-500/20 text-green-400 px-2 py-1 rounded mr-2 border border-green-500/30'>
											GET
										</span>
										<code className='text-gray-300'>/messages/threads</code>
									</div>
									<p className='mb-2 text-gray-300'>
										Получить переписки (диалоги) для аутентифицированного
										пользователя.
									</p>
									<div className='mb-2'>
										<strong className='text-white'>
											Параметры запроса (query):
										</strong>
										<ul className='list-disc pl-5 mt-1 text-gray-300'>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													page
												</code>{' '}
												(опционально, по умолчанию: 1) - Номер страницы
											</li>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													limit
												</code>{' '}
												(опционально, по умолчанию: 20) - Количество результатов
												на странице (макс. 100)
											</li>
										</ul>
									</div>
									<div>
										<strong className='text-white'>
											Требуется аутентификация:
										</strong>{' '}
										<span className='text-indigo-300'>Да</span>
									</div>
								</div>
							</div>
						</section>
					</div>
				)

			case 'comments':
				return (
					<div className='space-y-6'>
						<section>
							<h2 className='text-2xl font-bold mb-4 text-white'>
								API Комментариев
							</h2>
							<p className='mb-4 text-gray-300'>
								Управление комментариями к постам через API комментариев.
							</p>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Получить комментарии к посту
								</h3>
								<div className='bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
									<div className='flex items-center mb-2'>
										<span className='bg-green-500/20 text-green-400 px-2 py-1 rounded mr-2 border border-green-500/30'>
											GET
										</span>
										<code className='text-gray-300'>
											/comments/post/{'{post_id}'}
										</code>
									</div>
									<p className='mb-2 text-gray-300'>
										Получить все комментарии к определенному посту.
									</p>
									<div className='mb-2'>
										<strong className='text-white'>
											Параметры запроса (query):
										</strong>
										<ul className='list-disc pl-5 mt-1 text-gray-300'>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													page
												</code>{' '}
												(опционально, по умолчанию: 1) - Номер страницы
											</li>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													limit
												</code>{' '}
												(опционально, по умолчанию: 20) - Количество результатов
												на странице (макс. 100)
											</li>
										</ul>
									</div>
									<div>
										<strong className='text-white'>
											Требуется аутентификация:
										</strong>{' '}
										<span className='text-gray-300'>
											Нет (если пост публичный)
										</span>
									</div>
								</div>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Создать комментарий
								</h3>
								<div className='bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
									<div className='flex items-center mb-2'>
										<span className='bg-blue-500/20 text-blue-400 px-2 py-1 rounded mr-2 border border-blue-500/30'>
											POST
										</span>
										<code className='text-gray-300'>/comments</code>
									</div>
									<p className='mb-2 text-gray-300'>
										Создать новый комментарий к посту.
									</p>
									<div className='mb-2'>
										<strong className='text-white'>
											Параметры тела запроса (body):
										</strong>
										<ul className='list-disc pl-5 mt-1 text-gray-300'>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													post_id
												</code>{' '}
												(обязательно) - ID поста, к которому добавляется
												комментарий
											</li>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													content
												</code>{' '}
												(обязательно) - Содержание комментария
											</li>
										</ul>
									</div>
									<div>
										<strong className='text-white'>
											Требуется аутентификация:
										</strong>{' '}
										<span className='text-indigo-300'>Да</span>
									</div>
								</div>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Обновить комментарий
								</h3>
								<div className='bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
									<div className='flex items-center mb-2'>
										<span className='bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded mr-2 border border-yellow-500/30'>
											PUT
										</span>
										<code className='text-gray-300'>
											/comments/{'{comment_id}'}
										</code>
									</div>
									<p className='mb-2 text-gray-300'>
										Обновить существующий комментарий.
									</p>
									<div className='mb-2'>
										<strong className='text-white'>
											Параметры тела запроса (body):
										</strong>
										<ul className='list-disc pl-5 mt-1 text-gray-300'>
											<li>
												<code className='bg-gray-800/50 px-1 py-0.5 rounded text-indigo-300 border border-white/10'>
													content
												</code>{' '}
												(опционально) - Новое содержание комментария
											</li>
										</ul>
									</div>
									<div>
										<strong className='text-white'>
											Требуется аутентификация:
										</strong>{' '}
										<span className='text-indigo-300'>
											Да (должен быть владельцем комментария)
										</span>
									</div>
								</div>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Удалить комментарий
								</h3>
								<div className='bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
									<div className='flex items-center mb-2'>
										<span className='bg-red-500/20 text-red-400 px-2 py-1 rounded mr-2 border border-red-500/30'>
											DELETE
										</span>
										<code className='text-gray-300'>
											/comments/{'{comment_id}'}
										</code>
									</div>
									<p className='text-gray-300'>Удалить комментарий.</p>
									<div>
										<strong className='text-white'>
											Требуется аутентификация:
										</strong>{' '}
										<span className='text-indigo-300'>
											Да (должен быть владельцем комментария или владельцем
											поста)
										</span>
									</div>
								</div>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Поставить/Убрать лайк с комментариев
								</h3>
								<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
									<div className='bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
										<div className='flex items-center mb-2'>
											<span className='bg-blue-500/20 text-blue-400 px-2 py-1 rounded mr-2 border border-blue-500/30'>
												POST
											</span>
											<code className='text-gray-300'>
												/comments/{'{comment_id}'}/like
											</code>
										</div>
										<p className='text-gray-300'>Поставить лайк комментарию</p>
									</div>
									<div className='bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
										<div className='flex items-center mb-2'>
											<span className='bg-red-500/20 text-red-400 px-2 py-1 rounded mr-2 border border-red-500/30'>
												POST
											</span>
											<code className='text-gray-300'>
												/comments/{'{comment_id}'}/unlike
											</code>
										</div>
										<p className='text-gray-300'>Убрать лайк с комментария</p>
									</div>
								</div>
							</div>
						</section>
					</div>
				)

			case 'oauth2':
				return (
					<div className='space-y-6'>
						<section>
							<h2 className='text-2xl font-bold mb-4 text-white'>
								OAuth 2.0 (Вондик)
							</h2>
							<p className='mb-4 text-gray-300'>
								Вондик поддерживает OAuth 2.0 в стиле Yandex/Google: можно
								подключать вход через Вондик в сторонние приложения и сервисы.
							</p>
							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Базовые URL
								</h3>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`Authorize: https://vondic.ru/oauth/authorize
Token:     https://vondic.ru/oauth/token
Userinfo:  https://vondic.ru/oauth/userinfo`}
								</pre>
								<p className='mt-2 text-sm text-gray-400'>
									Настройка OAuth-приложений выполняется в
									<code className='mx-1 text-indigo-300'>
										Настройки → Разработчик → OAuth приложения и настройки
									</code>
									. В интегрируемом проекте обычно указываются только
									<code className='mx-1 text-indigo-300'>
										client_id / client_secret
									</code>
									, а redirect URI и остальные параметры приоритетно берутся из
									настроек приложения на сайте Вондик.
								</p>
							</div>
							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Шаг 1: получить code
								</h3>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`GET /oauth/authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&state={state}`}
								</pre>
								<p className='mt-2 text-sm text-gray-400'>
									Пользователь видит специальную страницу подтверждения доступа
									(экран consent в стиле Google/Yandex) с кнопками
									<code className='mx-1 text-indigo-300'>Разрешить</code> /
									<code className='mx-1 text-indigo-300'>Отказать</code>.
								</p>
							</div>
							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Шаг 2: обмен code на access_token
								</h3>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`curl -X POST https://vondic.ru/oauth/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=authorization_code" \\
  -d "code=AUTH_CODE" \\
  -d "redirect_uri=https://app.example.com/callback" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET"`}
								</pre>
							</div>
							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Шаг 3: userinfo
								</h3>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`curl https://vondic.ru/oauth/userinfo \\
  -H "Authorization: Bearer ACCESS_TOKEN"`}
								</pre>
							</div>
							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Refresh token
								</h3>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`curl -X POST https://vondic.ru/oauth/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=refresh_token" \\
  -d "refresh_token=OLD_ACCESS_TOKEN" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET"`}
								</pre>
							</div>
							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Пример интеграции (Node.js/Express)
								</h3>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`app.get("/oauth/login", (req, res) => {
  const state = crypto.randomUUID();
  req.session.oauthState = state;
  const qs = new URLSearchParams({
    client_id: process.env.VONDIC_CLIENT_ID,
    redirect_uri: "http://localhost:3000/oauth/callback",
    response_type: "code",
    state,
  });
  res.redirect("https://vondic.ru/oauth/authorize?" + qs);
});

app.get("/oauth/callback", async (req, res) => {
  const { code, state } = req.query;
  if (state !== req.session.oauthState) return res.status(400).send("Invalid state");
  // exchange code on /oauth/token, then call /oauth/userinfo
});`}
								</pre>
							</div>
							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Popup flow (как Google/Yandex)
								</h3>
								<p className='mb-2 text-sm text-gray-400'>
									Рекомендуемый UX: открывайте
									<code className='mx-1 text-indigo-300'>/oauth/authorize</code> в
									новом окне, а на странице callback отправляйте
									<code className='mx-1 text-indigo-300'>code/state</code> в
									родительское окно через
									<code className='mx-1 text-indigo-300'>window.opener.postMessage</code>.
								</p>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`// 1) Frontend (кнопка "Войти через Вондик")
const state = crypto.randomUUID();
sessionStorage.setItem("vondic_oauth_state", state);

const redirectUri = "https://app.example.com/oauth/callback";
const authUrl =
  "https://vondic.ru/oauth/authorize?" +
  new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_VONDIC_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });

const popup = window.open(
  authUrl,
  "vondic_oauth",
  "width=520,height=720,menubar=no,toolbar=no,location=no,status=no"
);

if (!popup) {
  // fallback, если popup заблокирован
  window.location.href = authUrl;
}

window.addEventListener("message", async (event) => {
  if (event.origin !== "https://app.example.com") return;
  const { type, code, state: returnedState, error } = event.data || {};
  if (type !== "vondic_oauth_result") return;

  if (error) {
    console.error("OAuth denied:", error);
    return;
  }

  const expectedState = sessionStorage.getItem("vondic_oauth_state");
  if (!expectedState || expectedState !== returnedState) {
    console.error("Invalid OAuth state");
    return;
  }

  // 2) Обмен code -> access_token
  const tokenResp = await fetch("/api/oauth/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  });
  const tokenData = await tokenResp.json();
  console.log("OAuth token:", tokenData.access_token);
});`}
								</pre>
								<pre className='mt-3 bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`// 3) Страница callback: https://app.example.com/oauth/callback
// (если это Next.js page/component, этот код выполняется в браузере)
const params = new URLSearchParams(window.location.search);
const code = params.get("code");
const state = params.get("state");
const error = params.get("error");

if (window.opener && !window.opener.closed) {
  window.opener.postMessage(
    {
      type: "vondic_oauth_result",
      code,
      state,
      error,
    },
    window.location.origin
  );
  window.close();
}`}
								</pre>
							</div>
							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Управление OAuth-клиентами
								</h3>
								<div className='space-y-2 text-sm text-gray-300'>
									<div className='rounded-lg border border-white/10 bg-white/5 px-3 py-2'>
										<code className='text-green-400'>GET</code>{' '}
										<code>/oauth/clients</code> - получить свои приложения
									</div>
									<div className='rounded-lg border border-white/10 bg-white/5 px-3 py-2'>
										<code className='text-blue-400'>POST</code>{' '}
										<code>/oauth/clients</code> - создать приложение (name,
										description, redirect_uris, logo_url, default_scopes)
									</div>
									<div className='rounded-lg border border-white/10 bg-white/5 px-3 py-2'>
										<code className='text-yellow-400'>PUT</code>{' '}
										<code>/oauth/clients/{'{client_id}'}</code> - обновить
										настройки приложения (в т.ч. logo_url и default_scopes)
									</div>
									<div className='rounded-lg border border-white/10 bg-white/5 px-3 py-2'>
										<code className='text-red-400'>DELETE</code>{' '}
										<code>/oauth/clients/{'{client_id}'}</code> - удалить
										приложение
									</div>
								</div>
							</div>
						</section>
					</div>
				)

			case 'botiksdk':
				return (
					<div className='space-y-6'>
						<section>
							<h2 className='text-2xl font-bold mb-4 text-white'>BotikSDK</h2>
							<p className='mb-4 text-gray-300'>
								Подробная документация Python SDK для разработки ботов Вондик:
								фильтры, callbacks, FSM, клавиатуры, OAuth/API key интеграция и
								готовые примеры для продакшена.
							</p>

							<div className='mb-6'>
								<div className='flex flex-wrap items-center gap-2'>
									<button
										onClick={() => setBotikSdkVersion('0.5.0')}
										className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
											botikSdkVersion === '0.5.0'
												? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
												: 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
										}`}
									>
										v0.5.0 (текущая)
									</button>
									<button
										onClick={() => setBotikSdkVersion('0.4.2')}
										className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
											botikSdkVersion === '0.4.2'
												? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
												: 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
										}`}
									>
										v0.4.2
									</button>
									<button
										onClick={() => setBotikSdkVersion('0.4.0')}
										className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
											botikSdkVersion === '0.4.0'
												? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
												: 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
										}`}
									>
										v0.4.0
									</button>
									<button
										onClick={() => setBotikSdkVersion('0.3.1')}
										className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
											botikSdkVersion === '0.3.1'
												? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
												: 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
										}`}
									>
										v0.3.1
									</button>
									<button
										onClick={() => setBotikSdkVersion('0.3.0')}
										className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
											botikSdkVersion === '0.3.0'
												? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
												: 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
										}`}
									>
										v0.3.0
									</button>
									<span className='text-xs text-gray-400 ml-1'>
										Версию можно закрепить через <code>pip install botiksdk==X.Y.Z</code>
									</span>
								</div>
							</div>

							{botikSdkVersion === '0.5.0' ? (
								<>
									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>Установка</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>{`pip install botiksdk==0.5.0`}</pre>
									</div>
									<div className='mb-6'>
										<div className='bg-indigo-500/10 border-l-4 border-indigo-500 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
											<p className='font-semibold text-white'>Что нового в v0.5.0</p>
										</div>
										<ul className='list-disc pl-5 space-y-2 text-gray-300 mt-3'>
											<li><strong>WebSocket API</strong> — real-time обновления без polling</li>
											<li><strong>BotWebSocket</strong> — клиент для WebSocket подключения</li>
											<li><strong>dp.run_websocket()</strong> — запуск через WebSocket</li>
											<li><strong>Auto-reconnect</strong> — автоматическое переподключение с backoff</li>
											<li><strong>Всё из v0.4.2</strong> — 70+ методов, 15+ типов сообщений, consent, FSM</li>
										</ul>
									</div>
									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>WebSocket (вместо polling)</h3>
										<p className='text-gray-300 mb-3'>Бот получает обновления мгновенно через WebSocket вместо опроса каждые 2 секунды.</p>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200 text-sm'>
											{`import os
from botiksdk import Bot, Dispatcher

bot = Bot(bot_id=os.getenv("BOT_ID"), token=os.getenv("BOT_TOKEN"))
dp = Dispatcher()
dp.include_bot(bot)

# Вместо dp.run_polling() — используем WebSocket
dp.run_websocket()  # Мгновенные обновления, без задержек`}</pre>
									</div>
									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>БотWebSocket напрямую</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200 text-sm'>
											{`from botiksdk import BotWebSocket

def on_update(data):
    print(f"Получено: {data}")

ws = BotWebSocket(
    bot_id="your-bot-id",
    token="your-token",
    on_update=on_update,
)
ws.start()  # Фоновый поток
# ws.stop()  # Остановить`}</pre>
									</div>
									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>Типы сообщений + file_url</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200 text-sm'>
											{`@dp.message()
async def handle(message: Message, bot: Bot):
    if message.content_type == "voice":
        url = message.voice.file_url  # S3 URL
        await bot.send_message(str(message.chat.id), f"Голосовое: {url}")
    elif message.content_type == "poll":
        opts = ", ".join(o.text for o in message.poll.options)
        await bot.send_message(str(message.chat.id), f"Опрос: {message.poll.question}\\n{opts}")
    elif message.content_type == "photo":
        await bot.send_message(str(message.chat.id), f"Фото: {message.file_url}")
    else:
        await bot.send_message(str(message.chat.id), f"Тип: {message.content_type}")`}</pre>
									</div>
									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>Фильтры</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200 text-sm'>
											{`from botiksdk import Command, Text, Regex, F, RateLimit, RequireScopes

@dp.message(Command("help"))        # /help
@dp.message(Text(equals="Привет"))  # Точный текст
@dp.message(Regex(r"^\\d+$"))       # Regex
@dp.message(RateLimit(window_seconds=1.5))  # Anti-flood
@dp.message(RequireScopes("admin"))  # Permission check`}</pre>
									</div>
									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>Consent permissions</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200 text-sm'>
											{`@dp.message(Command("settings"), RequireScopes("basic_profile", "send_messages"))
async def cmd_settings(message: Message, bot: Bot):
    await bot.send_message(str(message.chat.id), "Настройки...")`}</pre>
									</div>
									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>FSM</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200 text-sm'>
											{`from botiksdk import FSMContext

@dp.message(Command("email"))
async def email(message: Message, bot: Bot, state: FSMContext):
    await bot.send_message(str(message.chat.id), "Введите email:")
    await state.set_state("waiting_email")

@dp.message(state="waiting_email")
async def got_email(message: Message, bot: Bot, state: FSMContext):
    await state.clear()
    await bot.send_message(str(message.chat.id), f"Email: {message.text}")`}</pre>
									</div>
									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>Полный пример</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200 text-sm'>
											{`# bot.py — BotikSDK v0.5.0 (WebSocket)
import logging, os
from botiksdk import Bot, Dispatcher, Message, Command, Text, RequireScopes
from botiksdk import ReplyKeyboardBuilder, KeyboardButton, InlineKeyboardBuilder, InlineKeyboardButton

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
logger = logging.getLogger(__name__)
bot = Bot(bot_id=os.getenv("BOT_ID"), token=os.getenv("BOT_TOKEN"))
dp = Dispatcher()
dp.include_bot(bot)

@dp.message(Command("start"))
async def start(message: Message, bot: Bot):
    kb = ReplyKeyboardBuilder()
    kb.row(KeyboardButton("🎮 Игры"), KeyboardButton("💰 Баланс"))
    kb.row(KeyboardButton("💳 Premium"), KeyboardButton("ℹ️ Помощь"))
    await bot.send_message(str(message.chat.id), "👋 Привет!", reply_markup=kb.as_markup())

@dp.message(Command("kb"))
async def kb(message: Message, bot: Bot):
    kb = ReplyKeyboardBuilder()
    kb.row(KeyboardButton("🎮 Игры"), KeyboardButton("💰 Баланс"))
    await bot.send_message(str(message.chat.id), "Меню:", reply_markup=kb.as_markup())

@dp.message(Text("🎮 Игры"))
async def games(message: Message, bot: Bot):
    builder = InlineKeyboardBuilder()
    builder.add(InlineKeyboardButton(text="Список игр", callback_data="games:list"))
    await bot.send_message(str(message.chat.id), "Выберите:", reply_markup=builder.as_markup())

@dp.message()
async def handle_all(message: Message, bot: Bot):
    ct = message.content_type
    if ct == "voice":
        await bot.send_message(str(message.chat.id), f"🎤 {message.voice.duration}с: {message.voice.file_url}")
    elif ct == "video":
        await bot.send_message(str(message.chat.id), f"🎬 {message.video.duration}с: {message.video.file_url}")
    elif ct == "poll":
        opts = ", ".join(o.text for o in message.poll.options)
        await bot.send_message(str(message.chat.id), f"📊 {message.poll.question}\\n{opts}")
    else:
        await bot.send_message(str(message.chat.id), f"Получено: {ct}")

@dp.errors()
async def on_error(update, bot, error):
    logger.error("Error: %s", error, exc_info=True)

# Запуск через WebSocket (мгновенные обновления)
dp.run_websocket()`}</pre>
									</div>
								</>
							) : botikSdkVersion === '0.4.2' ? (
								<>
									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>Установка</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>{`pip install botiksdk==0.4.2`}</pre>
									</div>
									<div className='mb-6'>
										<div className='bg-indigo-500/10 border-l-4 border-indigo-500 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
											<p className='font-semibold text-white'>Что нового</p>
										</div>
										<ul className='list-disc pl-5 space-y-2 text-gray-300 mt-3'>
											<li><strong>15+ типов сообщений</strong> — text, photo, video, voice, poll, sticker, location, contact, dice и др.</li>
											<li><strong>content_type</strong> — автоопределение типа</li>
											<li><strong>file_url</strong> — S3 URL для скачивания медиа</li>
											<li><strong>to_dict()</strong> — полная сериализация в JSON</li>
											<li><strong>Push</strong> — прокидывает все типы контента</li>
										</ul>
									</div>
									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>Типы сообщений</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200 text-sm'>
											{`@dp.message()
async def handle(message: Message, bot: Bot):
    if message.content_type == "voice":
        url = message.voice.file_url  # S3 URL
        await bot.send_message(str(message.chat.id), f"Голосовое: {url}")
    elif message.content_type == "video":
        await bot.send_message(str(message.chat.id), f"Видео: {message.video.file_url}")
    elif message.content_type == "poll":
        opts = ", ".join(o.text for o in message.poll.options)
        await bot.send_message(str(message.chat.id), f"Опрос: {message.poll.question}\\n{opts}")
    elif message.content_type == "photo":
        await bot.send_message(str(message.chat.id), f"Фото: {message.file_url}")
    elif message.content_type == "location":
        await bot.send_message(str(message.chat.id), f"📍 {message.location.latitude}, {message.location.longitude}")
    elif message.content_type == "sticker":
        await bot.send_message(str(message.chat.id), f"Стикер: {message.sticker.emoji}")
    elif message.content_type == "contact":
        await bot.send_message(str(message.chat.id), f"Контакт: {message.contact.first_name}")
    elif message.content_type == "dice":
        await bot.send_message(str(message.chat.id), f"Кубик: {message.dice.value}")
    elif message.content_type == "document":
        await bot.send_message(str(message.chat.id), f"📄 {message.document.file_name}: {message.document.file_url}")`}</pre>
									</div>
									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>Сериализация и File URL</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200 text-sm'>
											{`# to_dict() — JSON-сериализация
json_data = message.to_dict()
# {"message_id":"123","content_type":"voice","voice":{"file_url":"https://s3.vondic.ru/..."}}

# File URL для скачивания
url = message.file_url        # S3 URL
fid = message.media_file_id   # file_id`}
										</pre>
									</div>
									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>Шаблон</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200 text-sm'>
											{`import logging, os
from botiksdk import Bot, Dispatcher, Message, Command, Text, RequireScopes
from botiksdk import ReplyKeyboardBuilder, KeyboardButton, InlineKeyboardBuilder, InlineKeyboardButton

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
logger = logging.getLogger(__name__)
bot = Bot(bot_id=os.getenv("BOT_ID"), token=os.getenv("BOT_TOKEN"))
dp = Dispatcher()
dp.include_bot(bot)

@dp.message(Command("start"))
async def start(message: Message, bot: Bot):
    kb = ReplyKeyboardBuilder()
    kb.row(KeyboardButton("🎮 Игры"), KeyboardButton("💰 Баланс"))
    await bot.send_message(str(message.chat.id), "👋 Привет!", reply_markup=kb.as_markup())

@dp.message(Command("kb"))
async def kb(message: Message, bot: Bot):
    kb = ReplyKeyboardBuilder()
    kb.row(KeyboardButton("🎮 Игры"), KeyboardButton("💰 Баланс"))
    await bot.send_message(str(message.chat.id), "Меню:", reply_markup=kb.as_markup())

@dp.message(Text("🎮 Игры"))
async def games(message: Message, bot: Bot):
    builder = InlineKeyboardBuilder()
    builder.add(InlineKeyboardButton(text="Список игр", callback_data="games:list"))
    await bot.send_message(str(message.chat.id), "Выберите:", reply_markup=builder.as_markup())

@dp.message(RequireScopes("basic_profile"))
async def auth_required(message: Message, bot: Bot):
    await bot.send_message(str(message.chat.id), f"Тип: {message.content_type}")

@dp.errors()
async def on_error(update, bot, error):
    logger.error("Error: %s", error, exc_info=True)

dp.run_polling()`}
										</pre>
									</div>
									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>Фильтры</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200 text-sm'>
											{`from botiksdk import Command, Text, Regex, F, RateLimit, RequireScopes

@dp.message(Command("help"))        # /help
@dp.message(Text(equals="Привет"))  # Точный текст
@dp.message(Regex(r"^\\d+$"))       # Regex
@dp.message(RateLimit(window_seconds=1.5))  # Anti-flood
@dp.message(RequireScopes("admin"))  # Permission`}
										</pre>
									</div>
									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>FSM</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200 text-sm'>
											{`from botiksdk import FSMContext

@dp.message(Command("email"))
async def email(message: Message, bot: Bot, state: FSMContext):
    await bot.send_message(str(message.chat.id), "Введите email:")
    await state.set_state("waiting_email")

@dp.message(state="waiting_email")
async def got_email(message: Message, bot: Bot, state: FSMContext):
    await state.clear()
    await bot.send_message(str(message.chat.id), f"Email: {message.text}")`}
										</pre>
									</div>
									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>Error handlers</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200 text-sm'>
											{`@dp.errors()
async def on_error(update, bot, error):
    logger.error("Error: %s", error, exc_info=True)`}
										</pre>
									</div>
								</>
							) : botikSdkVersion === '0.4.0' ? (
								<>
									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Установка
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`pip install botiksdk==0.4.0`}
										</pre>
									</div>

									<div className='mb-6'>
										<div className='bg-indigo-500/10 border-l-4 border-indigo-500 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
											<p className='font-semibold text-white'>Что нового в v0.4.0</p>
											<p className='text-gray-300 mt-1'>Масштабное обновление — 70+ методов API:</p>
										</div>
										<ul className='list-disc pl-5 space-y-2 text-gray-300 mt-3'>
											<li><strong>InputMedia</strong> — альбомы фото/видео через send_media_group</li>
											<li><strong>Локации и контакты</strong> — send_location, send_venue, send_contact</li>
											<li><strong>Пакетные операции</strong> — delete_messages, forward_messages</li>
											<li><strong>Управление чатом</strong> — get_chat, leave_chat, get_chat_member_count</li>
											<li><strong>Инвайт-ссылки</strong> — create_chat_invite_link, revoke_chat_invite_link</li>
											<li><strong>Inline queries</strong> — обработка inline-запросов</li>
											<li><strong>Стикерпаки</strong> — get_sticker_set, set_sticker_set_title</li>
											<li><strong>Webhook</strong> — set_webhook, delete_webhook, get_webhook_info</li>
											<li><strong>Consent permissions</strong> — RequireScopes, check_permissions</li>
											<li><strong>Chat actions</strong> — send_chat_action (typing, upload_photo...)</li>
											<li><strong>FSM Redis</strong> — бэкенд состояний на Redis</li>
											<li><strong>Middleware</strong> — pre/post обработка на уровне диспетчера</li>
										</ul>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Шаблон для старта
										</h3>
										<p className='text-gray-400 text-sm mb-3'>Минимальный рабочий бот с командами /start, /kb, /help и логированием.</p>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200 text-sm leading-relaxed'>
											{`# bot.py — Шаблон бота на BotikSDK v0.4.0
# pip install botiksdk==0.4.0

import logging
import os
from botiksdk import Bot, Dispatcher, Message, Command, Text

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

bot = Bot(bot_id=os.getenv("BOT_ID", "your-bot-id"))
dp = Dispatcher()
dp.include_bot(bot)

@dp.message(Command("start"))
async def cmd_start(message: Message, bot: Bot):
    await bot.send_message(str(message.chat.id), "Привет! Я бот.")

@dp.message(Command("kb"))
async def cmd_kb(message: Message, bot: Bot):
    await bot.send_message(str(message.chat.id), "Меню (скоро)")

@dp.message(Command("help"))
async def cmd_help(message: Message, bot: Bot):
    await bot.send_message(str(message.chat.id), "Команды:\\n/start — старт\\n/kb — меню\\n/help — эта справка")

if __name__ == "__main__":
    logger.info("Бот запускается...")
    dp.run_polling()`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Команда /kb
										</h3>
										<p className='text-gray-300 mb-3'>
											Универсальная команда на уровне фреймворка. Если бот зарегистрировал обработчик <code>/kb</code> — вызывается он.
											Если нет — фреймворк автоматически показывает reply-клавиатуру с дефолтными кнопками.
										</p>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`@dp.message(Command("kb"))
async def cmd_kb(message: Message, bot: Bot):
    kb = ReplyKeyboardBuilder()
    kb.row(KeyboardButton("🎮 Игры"), KeyboardButton("💰 Баланс"))
    kb.row(KeyboardButton("💳 Premium"), KeyboardButton("ℹ️ Помощь"))
    await bot.send_message(str(message.chat.id), "Меню:", reply_markup=kb.as_markup())`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Reply-клавиатура
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`from botiksdk import ReplyKeyboardBuilder, KeyboardButton, ReplyKeyboardRemove

kb = ReplyKeyboardBuilder()
kb.row(KeyboardButton("Помощь"), KeyboardButton("Настройки"))
kb.row(KeyboardButton("📍 Локация", request_location=True))
await message.answer("Выберите:", reply_markup=kb.as_markup())

# Удалить клавиатуру
await message.answer("Готово!", reply_markup=ReplyKeyboardRemove().as_markup())`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Inline-клавиатура
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`from botiksdk import InlineKeyboardBuilder, InlineKeyboardButton

kb = InlineKeyboardBuilder()
kb.add(InlineKeyboardButton(text="Нажми", callback_data="pressed"))
kb.row(
    InlineKeyboardButton(text="Google", url="https://google.com"),
    InlineKeyboardButton(text="Яндекс", url="https://yandex.ru"),
)
await bot.send_message(chat_id, "Выбери:", reply_markup=kb.as_markup())`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											InputMedia (альбомы)
										</h3>
										<p className='text-gray-300 mb-3'>
											Отправка нескольких фото/видео как альбома через <code>send_media_group</code>.
										</p>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`from botiksdk import InputMediaPhoto, InputMediaVideo, InputFile

media = [
    InputMediaPhoto(InputFile(path="photo1.jpg"), caption="Фото 1"),
    InputMediaPhoto(InputFile(path="photo2.jpg")),
    InputMediaVideo(InputFile(path="video.mp4"), caption="Видео"),
]
await bot.send_media_group(chat_id, media)`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Локации и контакты
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`# Точка на карте
await bot.send_location(chat_id, latitude=55.7558, longitude=37.6173)

# Место (с названием и адресом)
await bot.send_venue(chat_id, latitude=55.7558, longitude=37.6173,
                     title="Красная площадь", address="Москва")

# Контакт
await bot.send_contact(chat_id, phone_number="+79001234567",
                       first_name="Иван", last_name="Петров")`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Пакетные операции
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`# Удалить несколько сообщений
await bot.delete_messages(chat_id, [msg1_id, msg2_id, msg3_id])

# Переслать несколько сообщений
await bot.forward_messages(
    from_chat_id=chat_id,
    to_chat_id=target_chat_id,
    message_ids=[msg1_id, msg2_id],
)`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Управление чатом
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`# Информация о чате
chat = await bot.get_chat(chat_id)
print(f"Название: {chat.title}, тип: {chat.type}")

# Количество участников
count = await bot.get_chat_member_count(chat_id)
print(f"Участников: {count}")

# Покинуть чат
await bot.leave_chat(chat_id)`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Инвайт-ссылки
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`# Создать инвайт-ссылку
link = await bot.create_chat_invite_link(
    chat_id,
    name="Приглашение для подписчиков",
    member_limit=100,
    creates_join_request=False,
)
print(f"Ссылка: {link.invite_link}")

# Отозвать ссылку
await bot.revoke_chat_invite_link(chat_id, link.invite_link)`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Consent permissions
										</h3>
										<p className='text-gray-300 mb-3'>
											Фильтр <code>RequireScopes</code> проверяет, что пользователь выдал боту необходимые разрешения.
										</p>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`from botiksdk import RequireScopes, check_permissions

@dp.message(Command("analytics"), RequireScopes("analytics:read"))
async def cmd_analytics(message: Message, bot: Bot):
    await bot.send_message(str(message.chat.id), "Данные аналитики...")

# Проверка прав вручную
@dp.message(Command("settings"))
async def cmd_settings(message: Message, bot: Bot):
    ok = await check_permissions(message, scopes=["settings:write"])
    if not ok:
        await bot.send_message(str(message.chat.id), "Нет прав")
        return
    await bot.send_message(str(message.chat.id), "Настройки...")`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Фильтры
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`from botiksdk import Command, Text, Regex, F, RateLimit, RequireScopes

@dp.message(Command("help"))
async def cmd_help(message, bot, state): ...

@dp.message(Text(equals="Привет"))
async def exact_text(message, bot, state): ...

@dp.message(Regex(r"^\\d+$"))
async def only_numbers(message, bot, state): ...

@dp.message(F.message.text.contains("купить"))
async def buy_intent(message, bot, state): ...

@dp.message(RateLimit(window_seconds=1.5, key="user"))
async def antiflood(message, bot, state): ...

@dp.message(RequireScopes("admin"))
async def admin_only(message, bot, state): ...`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											FSM (управление состояниями)
										</h3>
										<p className='text-gray-300 mb-3'>
											FSM Redis — бэкенд для хранения состояний диалога в Redis. Поддерживает <code>set_state</code>, <code>update_data</code>, <code>get_data</code>, <code>clear</code>.
										</p>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`from botiksdk.fsm import FSMRedisStorage

storage = FSMRedisStorage(host="localhost", port=6379, db=0)
dp = Dispatcher(storage=storage)

class States:
    name = "name"
    email = "email"

@dp.message(Command("register"))
async def register_start(message, bot, state):
    await state.set_state(States.name)
    await bot.send_message(str(message.chat.id), "Ваше имя?")

@dp.message(state=States.name)
async def register_name(message, bot, state):
    await state.update_data(name=message.text)
    await state.set_state(States.email)
    await bot.send_message(str(message.chat.id), "Email?")

@dp.message(state=States.email)
async def register_email(message, bot, state):
    data = await state.get_data()
    await state.clear()
    await bot.send_message(str(message.chat.id), f"Готово: {data['name']}, {message.text}")`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Startup/Shutdown
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`@dp.startup
async def on_startup():
    logger.info("Бот запущен!")

@dp.shutdown
async def on_shutdown():
    logger.info("Бот остановлен!")`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Error handlers
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`@dp.errors()
async def on_error(update, bot, error):
    logger.error("Handler error: %s", error, exc_info=True)
    if hasattr(update, "message") and update.message:
        await bot.send_message(str(update.message.chat.id), "⚠️ Ошибка")`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Webhook
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`# Установить webhook
await bot.set_webhook(
    url="https://your-domain.com/webhook",
    secret_token="your-secret",
    allowed_updates=["message", "callback_query"],
)

# Проверить webhook
info = await bot.get_webhook_info()
print(f"URL: {info.url}, pending: {info.pending_update_count}")

# Удалить webhook
await bot.delete_webhook()`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Middleware
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`from botiksdk import BaseMiddleware

class LoggingMiddleware(BaseMiddleware):
    async def __call__(self, handler, event, data):
        logger.info("Update: %s", event)
        result = await handler(event, data)
        logger.info("Handled: %s", event)
        return result

dp.message.middleware(LoggingMiddleware())`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Полный пример бота
										</h3>
										<p className='text-gray-400 text-sm mb-3'>Готовый бот с основными командами, клавиатурами, callback, фильтрами и error handler.</p>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200 text-sm leading-relaxed'>
											{`# full_bot.py — Полный пример бота на BotikSDK v0.4.0
# pip install botiksdk==0.4.0

import logging
import os
from botiksdk import (
    Bot, Dispatcher, Message, Command, Text, F,
    ReplyKeyboardBuilder, KeyboardButton,
    InlineKeyboardBuilder, InlineKeyboardButton,
    RateLimit,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

bot = Bot(bot_id=os.getenv("BOT_ID", "your-bot-id"))
dp = Dispatcher()
dp.include_bot(bot)

# ── Startup ──────────────────────────────────────

@dp.startup
async def on_startup():
    logger.info("Бот запущен!")

@dp.shutdown
async def on_shutdown():
    logger.info("Бот остановлен!")

# ── Команды ──────────────────────────────────────

@dp.message(Command("start"))
async def cmd_start(message: Message, bot: Bot):
    kb = InlineKeyboardBuilder()
    kb.add(InlineKeyboardButton(text="Помощь", callback_data="help"))
    await bot.send_message(str(message.chat.id), "Привет! Нажми кнопку:", reply_markup=kb.as_markup())

@dp.message(Command("kb"))
async def cmd_kb(message: Message, bot: Bot):
    kb = ReplyKeyboardBuilder()
    kb.row(KeyboardButton("🎮 Игры"), KeyboardButton("💰 Баланс"))
    kb.row(KeyboardButton("ℹ️ Помощь"))
    await bot.send_message(str(message.chat.id), "Меню:", reply_markup=kb.as_markup())

@dp.message(Command("help"))
async def cmd_help(message: Message, bot: Bot):
    await bot.send_message(str(message.chat.id), "Команды:\\n/start — старт\\n/kb — меню\\n/help — справка")

# ── Callback ─────────────────────────────────────

@dp.callback_query(F.data == "help")
async def on_help(callback, bot):
    await bot.send_message(str(callback.message.chat.id), "Это помощь!")
    await bot.answer_callback_query(callback.id)

# ── Фильтры ─────────────────────────────────────

@dp.message(Text(equals="🎮 Игры"))
async def games(message: Message, bot: Bot):
    await bot.send_message(str(message.chat.id), "Игры в разработке!")

@dp.message(RateLimit(window_seconds=2, key="user"))
async def antiflood(message: Message, bot: Bot):
    await bot.send_message(str(message.chat.id), "Не спамьте!")

# ── Error handler ────────────────────────────────

@dp.errors()
async def on_error(update, bot, error):
    logger.error("Error: %s", error, exc_info=True)

# ── Запуск ───────────────────────────────────────

if __name__ == "__main__":
    logger.info("Бот запускается...")
    dp.run_polling()`}
										</pre>
									</div>
								</>
							) : botikSdkVersion === '0.3.1' ? (
								<>
									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Установка
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`pip install botiksdk==0.3.1`}
										</pre>
									</div>

									<div className='mb-6'>
										<div className='bg-indigo-500/10 border-l-4 border-indigo-500 p-4 rounded-lg backdrop-blur-sm border border-white/10'>
											<p className='font-semibold text-white'>Что нового в v0.3.1</p>
											<p className='text-gray-300 mt-1'>Исправления стабильности и совместимости:</p>
										</div>
										<ul className='list-disc pl-5 space-y-2 text-gray-300 mt-3'>
											<li><strong>Универсальная команда /kb</strong> — framework-level: если бот не имеет своего обработчика, показывает reply-клавиатуру по умолчанию</li>
											<li><strong>Retry backoff</strong> — при ошибках polling бот использует exponential backoff (2→4→6→8→10 сек) вместо фиксированного 1 сек</li>
											<li><strong>Исправлен error handler</strong> — сигнатура <code>@dp.errors()</code> теперь корректно передаёт <code>update</code>, <code>bot</code>, <code>error</code></li>
											<li><strong>Reply keyboard работает через callback</strong> — нажатие кнопки отправляет текст как обычное сообщение боту</li>
											<li><strong>Убраны dev-зависимости</strong> — build, twine не входят в runtime dependencies</li>
										</ul>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Команда /kb
										</h3>
										<p className='text-gray-300 mb-3'>
											Универсальная команда на уровне фреймворка. Если бот зарегистрировал обработчик <code>/kb</code> — вызывается он.
											Если нет — фреймворк автоматически показывает reply-клавиатуру с дефолтными кнопками.
										</p>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`@dp.message(Command("kb"))
async def cmd_kb(message: Message, bot: Bot):
    kb = ReplyKeyboardBuilder()
    kb.row(KeyboardButton("🎮 Игры"), KeyboardButton("💰 Баланс"))
    kb.row(KeyboardButton("💳 Premium"), KeyboardButton("ℹ️ Помощь"))
    await bot.send_message(str(message.chat.id), "Меню:", reply_markup=kb.as_markup())`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Reply-клавиатура
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`from botiksdk import ReplyKeyboardBuilder, KeyboardButton, ReplyKeyboardRemove

kb = ReplyKeyboardBuilder()
kb.row(KeyboardButton('Помощь'), KeyboardButton('Настройки'))
kb.row(KeyboardButton('📍 Локация', request_location=True))
await message.answer('Выберите:', reply_markup=kb.as_markup())

# Удалить клавиатуру
await message.answer('Готово!', reply_markup=ReplyKeyboardRemove().as_markup())`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Шаблон для старта
										</h3>
										<p className='text-gray-400 text-sm mb-3'>Минимальный код — добавляй свои команды по мере необходимости.</p>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200 text-sm leading-relaxed'>
											{`# bot.py — Шаблон бота на BotikSDK v0.3.1
# pip install botiksdk==0.3.1

import logging
import os
from botiksdk import Bot, Dispatcher, Message, Command, Text

# Логирование — смотри что делает бот в консоли
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

# Создай файл .env.bot рядом с bot.py:
#   BOT_ID=your-bot-id
#   BOT_TOKEN=your-bot-token
bot = Bot(bot_id=os.getenv("BOT_ID", "your-bot-id"))
dp = Dispatcher()
dp.include_bot(bot)

# ── Команды ──────────────────────────────────────

@dp.message(Command("start"))
async def cmd_start(message: Message, bot: Bot):
    await bot.send_message(str(message.chat.id), "Привет! Я бот.")

@dp.message(Command("kb"))
async def cmd_kb(message: Message, bot: Bot):
    # Тут будет reply-клавиатура — добавишь позже
    await bot.send_message(str(message.chat.id), "Меню (скоро)")

@dp.message(Command("help"))
async def cmd_help(message: Message, bot: Bot):
    await bot.send_message(str(message.chat.id), "Команды:\\n/start — старт\\n/kb — меню\\n/help — эта справка")

# ── Запуск ───────────────────────────────────────

if __name__ == "__main__":
    logger.info("Бот запускается...")
    dp.run_polling()  # Бот опрашивает Vontic API и обрабатывает сообщения`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Файлы (InputFile)
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`from botiksdk import InputFile

photo = InputFile(path='/path/to/photo.jpg')
await bot.send_photo(chat_id, photo, caption='Фото')
await bot.send_document(chat_id, InputFile(file_bytes=b'...', filename='doc.pdf'))`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Модерация
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`await bot.ban_chat_member(chat_id, user_id)
await bot.restrict_chat_member(chat_id, user_id, permissions={'can_send_messages': False})
await bot.pin_chat_message(chat_id, message_id)
await bot.delete_message(chat_id, message_id)
await bot.get_chat_member(chat_id, user_id)`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Опросы
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`poll = await bot.send_poll(chat_id, 'Вопрос?', ['Да', 'Нет'], is_anonymous=True)
await bot.stop_poll(chat_id, poll.message_id)`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Callback actions
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`await bot.answer_callback_query(callback.id, text='Готово!', show_alert=True)
await bot.edit_message_text('Новый текст', chat_id, message_id)
await bot.edit_message_reply_markup(chat_id, message_id, reply_markup=new_kb)`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Bot commands
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`await bot.set_my_commands([
    {'command': 'start', 'description': 'Начать'},
    {'command': 'help', 'description': 'Помощь'},
])`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Startup/Shutdown
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`@dp.startup
async def on_startup():
    print('Бот запущен!')

@dp.shutdown
async def on_shutdown():
    print('Бот остановлен!')`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Error handlers
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`@dp.errors()
async def on_error(update, bot, error):
    logger.error("Handler error: %s", error, exc_info=True)
    if hasattr(update, "message") and update.message:
        await bot.send_message(str(update.message.chat.id), "⚠️ Ошибка")`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Интеграция с Vontic API
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`from botiksdk.client import PublicAPIClient

client = PublicAPIClient(bot_id="your-bot-id", bot_token="your-token")
# Все методы Bot используют client internally
# send_action, get_updates, send_message — через Vontic API`}
										</pre>
									</div>
								</>
							) : botikSdkVersion === '0.3.0' ? (
								<>
									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Установка
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`pip install botiksdk==0.3.0`}
										</pre>
									</div>
									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Что нового в v0.3.0
										</h3>
										<ul className='list-disc pl-5 space-y-2 text-gray-300'>
											<li>Reply-клавиатура (ReplyKeyboardBuilder, KeyboardButton, ReplyKeyboardRemove)</li>
											<li>Отправка файлов (InputFile, send_photo, send_document, send_voice, send_video)</li>
											<li>Модерация (ban, kick, restrict, promote, delete_message, pin_chat_message)</li>
											<li>Опросы (send_poll, stop_poll)</li>
											<li>Stickers (send_sticker, get_sticker_set)</li>
											<li>Callback actions (answer_callback_query, edit_message_text)</li>
											<li>Bot commands (set_my_commands, get_my_commands)</li>
											<li>Chat actions (send_chat_action — typing)</li>
											<li>Startup/Shutdown хуки (@dp.startup / @dp.shutdown)</li>
											<li>Error handlers (@dp.errors())</li>
										</ul>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Reply-клавиатура
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`from botiksdk import ReplyKeyboardBuilder, KeyboardButton, ReplyKeyboardRemove

kb = ReplyKeyboardBuilder()
kb.row(KeyboardButton('Помощь'), KeyboardButton('Настройки'))
kb.row(KeyboardButton('📍 Локация', request_location=True))
await message.answer('Выберите:', reply_markup=kb.as_markup())

# Удалить клавиатуру
await message.answer('Готово!', reply_markup=ReplyKeyboardRemove().as_markup())`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Файлы (InputFile)
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`from botiksdk import InputFile

photo = InputFile(path='/path/to/photo.jpg')
await bot.send_photo(chat_id, photo, caption='Фото')
await bot.send_document(chat_id, InputFile(file_bytes=b'...', filename='doc.pdf'))`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Модерация
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`await bot.ban_chat_member(chat_id, user_id)
await bot.restrict_chat_member(chat_id, user_id, permissions={'can_send_messages': False})
await bot.pin_chat_message(chat_id, message_id)
await bot.delete_message(chat_id, message_id)
await bot.get_chat_member(chat_id, user_id)`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Опросы
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`poll = await bot.send_poll(chat_id, 'Вопрос?', ['Да', 'Нет'], is_anonymous=True)
await bot.stop_poll(chat_id, poll.message_id)`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Callback actions
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`await bot.answer_callback_query(callback.id, text='Готово!', show_alert=True)
await bot.edit_message_text('Новый текст', chat_id, message_id)
await bot.edit_message_reply_markup(chat_id, message_id, reply_markup=new_kb)`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Bot commands
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`await bot.set_my_commands([
    {'command': 'start', 'description': 'Начать'},
    {'command': 'help', 'description': 'Помощь'},
])`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Startup/Shutdown
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`@dp.startup
async def on_startup():
    print('Бот запущен!')

@dp.shutdown
async def on_shutdown():
    print('Бот остановлен!')`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Error handlers
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`@dp.errors()
async def on_error(event, error):
    logger.error('Handler error: %s', error)
    await event.bot.send_message(event.message.chat.id, 'Ошибка')`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Интеграция с Vontic API (остаётся из v0.2.0)
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`import requests
from botiksdk.client import PublicAPIClient

# 1) exchange authorization code -> access_token
token_resp = requests.post("https://vondic.ru/oauth/token", data={
    "grant_type": "authorization_code",
    "code": "AUTH_CODE",
    "redirect_uri": "https://app.example.com/callback",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
})
access_token = token_resp.json()["access_token"]

# 2) get api key by oauth token
client = PublicAPIClient(base_url="https://vondic.ru")
api_key = client.get_api_key(access_token=access_token)["api_key"]

# 3) list bots / generate bot token
bots = client.list_bots(api_key=api_key)
print("bots:", bots)`}
										</pre>
									</div>
								</>
							) : botikSdkVersion === '0.2.0' ? (
								<>
									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Установка
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`pip install botiksdk==0.2.0
# или
pip install botiksdk`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Быстрый старт
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`import asyncio
from botiksdk import (
    Bot,
    Dispatcher,
    Command,
    InlineKeyboardBuilder,
    InlineKeyboardButton,
)

dp = Dispatcher()
bot = Bot(token="your-bot-token", base_url="https://vondic.ru")

@dp.message(Command("start"))
async def cmd_start(message, bot, state):
    kb = InlineKeyboardBuilder()
    kb.add(InlineKeyboardButton(text="Нажми меня", callback_data="pressed"))
    await bot.send_message(
        str(message.chat.id),
        "Привет!",
        reply_markup=kb.as_markup(),
    )

@dp.callback_query(lambda c: c.data == "pressed")
async def on_pressed(callback, bot, state):
    await bot.send_message(str(callback.message.chat.id), "Кнопка нажата!")
    await bot.answer_callback_query(callback.id)

async def main():
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											Возможности
										</h3>
										<ul className='list-disc pl-5 space-y-2 text-gray-300'>
											<li>
												<strong className='text-white'>Dispatcher</strong> — диспетчер
												для обработки обновлений
											</li>
											<li>
												<strong className='text-white'>Router</strong> — группировка
												хендлеров
											</li>
											<li>
												<strong className='text-white'>FSM</strong> — состояния диалога
											</li>
											<li>
												<strong className='text-white'>Filters</strong> — фильтры сообщений
												и callback query
											</li>
											<li>
												<strong className='text-white'>Inline Keyboard</strong> — конструктор
												кнопок
											</li>
											<li>
												<strong className='text-white'>Async-first</strong> — все API через
												<code className='mx-1 text-indigo-300'>await</code>
											</li>
											<li>
												<strong className='text-white'>Error Handlers</strong> — единая
												обработка исключений через <code className='mx-1 text-indigo-300'>@dp.errors()</code>
											</li>
											<li>
												<strong className='text-white'>Middlewares</strong> — pre/post
												обработка событий
											</li>
											<li>
												<strong className='text-white'>RateLimit</strong> — встроенный anti-flood
											</li>
										</ul>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>Фильтры</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`from botiksdk import Command, Text, Regex, F, RateLimit

@dp.message(Command("help"))
async def cmd_help(message, bot, state): ...

@dp.message(Text(equals="Привет"))
async def exact_text(message, bot, state): ...

@dp.message(Regex(r"^\\d+$"))
async def only_numbers(message, bot, state): ...

@dp.message(F.message.text.contains("купить"))
async def buy_intent(message, bot, state): ...

@dp.message(RateLimit(window_seconds=1.5, key="user"))
async def antiflood(message, bot, state): ...`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											FSM (состояния диалога)
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`class States:
    email = "email"
    password = "password"

@dp.message(Command("login"))
async def login_start(message, bot, state):
    await state.set_state(States.email)
    await bot.send_message(str(message.chat.id), "Введите email:")

@dp.message(lambda m: m.text is not None, state=States.email)
async def login_email(message, bot, state):
    await state.update_data(email=message.text)
    await state.set_state(States.password)
    await bot.send_message(str(message.chat.id), "Введите пароль:")

@dp.message(lambda m: m.text is not None, state=States.password)
async def login_password(message, bot, state):
    data = await state.get_data()
    await state.clear()
    await bot.send_message(str(message.chat.id), f"Готово: {data.get('email')}")`}
										</pre>
									</div>

									<div className='mb-6'>
										<h3 className='text-xl font-semibold mb-2 text-white'>
											BotikSDK + OAuth Вондик
										</h3>
										<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
											{`import requests
from botiksdk.client import PublicAPIClient

# 1) exchange authorization code -> access_token
token_resp = requests.post("https://vondic.ru/oauth/token", data={
    "grant_type": "authorization_code",
    "code": "AUTH_CODE",
    "redirect_uri": "https://app.example.com/callback",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
})
access_token = token_resp.json()["access_token"]

# 2) get api key by oauth token
client = PublicAPIClient(base_url="https://vondic.ru")
api_key = client.get_api_key(access_token=access_token)["api_key"]

# 3) list bots / generate bot token
bots = client.list_bots(api_key=api_key)
print("bots:", bots)`}
										</pre>
									</div>
								</>
							) : (
								<>
							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Установка
								</h3>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`pip install botiksdk`}
								</pre>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Быстрый старт
								</h3>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`import asyncio
from botiksdk import Bot, Dispatcher, Command

dp = Dispatcher()
bot = Bot(token="YOUR_BOT_TOKEN", base_url="https://vondic.ru")

@dp.message(Command("start"))
async def start_command(message, bot, state):
    await bot.send_message(str(message.chat.id), "Привет из BotikSDK!")

@dp.message()
async def echo(message, bot, state):
    if message.text:
        await bot.send_message(str(message.chat.id), f"Echo: {message.text}")

async def main():
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())`}
								</pre>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Основные возможности
								</h3>
								<ul className='list-disc pl-5 space-y-2 text-gray-300'>
									<li>Простой способ создания обработчиков сообщений</li>
									<li>Поддержка команд, коллбэков и inline-запросов</li>
									<li>Встроенная система фильтрации сообщений</li>
									<li>Интеграция с базами данных</li>
									<li>Мiddleware для обработки запросов</li>
									<li>Типизация для лучшей разработки</li>
								</ul>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Работа с сообщениями
								</h3>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`@router.message_handler(text="Привет")
async def hello_handler(message: Message):
    await message.answer(f"Привет, {message.from_user.full_name}!")

@router.message_handler(attachment=True)
async def attachment_handler(message: Message):
    # Обработка вложений
    if message.photo:
        await message.answer("Я получил фото!")
    elif message.document:
        await message.answer("Я получил документ!")`}
								</pre>
							</div>
							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Фильтры (command/text/regex/F)
								</h3>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`from botiksdk import Command, Text, Regex, F

@dp.message(Command("help"))
async def cmd_help(message, bot, state): ...

@dp.message(Text(equals="Привет"))
async def exact_text(message, bot, state): ...

@dp.message(Regex(r"^\\d+$"))
async def only_numbers(message, bot, state): ...

@dp.message(F.message.text.contains("купить"))
async def buy_intent(message, bot, state): ...`}
								</pre>
							</div>
							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Inline keyboard + callback
								</h3>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`from botiksdk import InlineKeyboardBuilder, InlineKeyboardButton

@dp.message(Command("menu"))
async def menu(message, bot, state):
    kb = InlineKeyboardBuilder()
    kb.row(
        InlineKeyboardButton(text="FAQ", callback_data="faq"),
        InlineKeyboardButton(text="Support", callback_data="support"),
    )
    kb.add(InlineKeyboardButton(text="Сайт", url="https://vondic.ru"))
    await bot.send_message(str(message.chat.id), "Выберите:", reply_markup=kb.as_markup())

@dp.callback_query(lambda c: c.data in ["faq", "support"])
async def on_click(callback, bot, state):
    await bot.answer_callback_query(callback.id)
    await bot.send_message(str(callback.message.chat.id), f"Вы нажали: {callback.data}")`}
								</pre>
							</div>
							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									FSM (состояния диалога)
								</h3>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`class RegStates:
    EMAIL = "email"
    PASSWORD = "password"

@dp.message(Command("register"))
async def reg_start(message, bot, state):
    await state.set_state(RegStates.EMAIL)
    await bot.send_message(str(message.chat.id), "Введите email")

@dp.message(state=RegStates.EMAIL)
async def reg_email(message, bot, state):
    await state.update_data(email=message.text)
    await state.set_state(RegStates.PASSWORD)
    await bot.send_message(str(message.chat.id), "Введите пароль")

@dp.message(state=RegStates.PASSWORD)
async def reg_password(message, bot, state):
    data = await state.get_data()
    await state.clear()
    await bot.send_message(str(message.chat.id), f"Готово: {data.get('email')}")`}
								</pre>
							</div>
							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									BotikSDK + OAuth Вондик
								</h3>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`import requests
from botiksdk.client import PublicAPIClient

# 1. exchange authorization code to access_token
token_resp = requests.post("https://vondic.ru/oauth/token", data={
    "grant_type": "authorization_code",
    "code": "AUTH_CODE",
    "redirect_uri": "https://app.example.com/callback",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
})
access_token = token_resp.json()["access_token"]

# 2. get api key by oauth token
client = PublicAPIClient(base_url="https://vondic.ru")
api_key = client.get_api_key(access_token=access_token)["api_key"]

# 3. list bots / generate bot token
bots = client.list_bots(api_key=api_key)
print("bots:", bots)`}
								</pre>
							</div>
								</>
							)}
						</section>
					</div>
				)

			case 'mail':
				return (
					<div className='space-y-6'>
						<section>
							<h2 className='text-2xl font-bold mb-4 text-white'>
								Mail API (@vondic.ru)
							</h2>
							<p className='mb-4 text-gray-300'>
								Публичный API для ящика{' '}
								<code className='text-indigo-300'>@vondic.ru</code>, привязанного
								к аккаунту. Базовый путь:{' '}
								<code className='text-indigo-300'>/api/public/v2/mail</code>
							</p>
							<div className='bg-indigo-500/10 border-l-4 border-indigo-500 p-4 mb-6 rounded-lg border border-white/10'>
								<p className='text-sm text-gray-300'>
									<strong className='text-white'>Аутентификация:</strong>{' '}
									заголовок{' '}
									<code className='text-indigo-300'>X-API-Key: YOUR_KEY</code>.
									Включите режим разработчика, создайте ключ в настройках и
									включите права в{' '}
									<strong className='text-white'>Настройки → Почта</strong>.
								</p>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Права API-ключа
								</h3>
								<ul className='list-disc pl-5 space-y-1 text-gray-300 text-sm'>
									<li>
										<code className='text-indigo-300'>send</code> — отправка
										писем
									</li>
									<li>
										<code className='text-indigo-300'>read</code> — список и
										чтение писем
									</li>
									<li>
										<code className='text-indigo-300'>delete</code> — перенос в
										корзину
									</li>
								</ul>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Текущие права и ящик
								</h3>
								<div className='bg-gray-800/30 p-4 rounded-lg border border-white/10'>
									<div className='flex items-center mb-2'>
										<span className='bg-green-500/20 text-green-400 px-2 py-1 rounded mr-2 border border-green-500/30'>
											GET
										</span>
										<code className='text-gray-300'>/mail/permissions</code>
									</div>
									<p className='text-gray-300 text-sm mb-2'>
										Возвращает{' '}
										<code className='text-indigo-300'>permissions</code> и{' '}
										<code className='text-indigo-300'>mailbox</code> (адрес
										ящика).
									</p>
								</div>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Отправить письмо
								</h3>
								<div className='bg-gray-800/30 p-4 rounded-lg border border-white/10'>
									<div className='flex items-center mb-2'>
										<span className='bg-blue-500/20 text-blue-400 px-2 py-1 rounded mr-2 border border-blue-500/30'>
											POST
										</span>
										<code className='text-gray-300'>/mail/send</code>
									</div>
									<p className='text-gray-300 text-sm mb-2'>
										Требуется право <code className='text-indigo-300'>send</code>
										. Тело JSON:
									</p>
									<pre className='bg-gray-900/50 p-3 rounded text-xs text-gray-200 overflow-x-auto border border-white/10'>
										{`{
  "to": "user@example.com",
  "subject": "Тема",
  "body_text": "Текст (plain)",
  "body_html": "<p>HTML (опционально)</p>",
  "cc": "copy@example.com"
}`}
									</pre>
									<pre className='mt-3 bg-gray-900/50 p-3 rounded text-xs text-gray-200 overflow-x-auto border border-white/10'>
										{`curl -X POST "https://api.vondic.ru/api/public/v2/mail/send" \\
  -H "X-API-Key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"to":"user@example.com","subject":"Hi","body_text":"Hello"}'`}
									</pre>
								</div>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Список писем
								</h3>
								<div className='bg-gray-800/30 p-4 rounded-lg border border-white/10'>
									<div className='flex items-center mb-2'>
										<span className='bg-green-500/20 text-green-400 px-2 py-1 rounded mr-2 border border-green-500/30'>
											GET
										</span>
										<code className='text-gray-300'>/mail/messages</code>
									</div>
									<p className='text-gray-300 text-sm'>
										Право <code className='text-indigo-300'>read</code>. Query:{' '}
										<code className='text-indigo-300'>folder</code> (по умолчанию
										INBOX), <code className='text-indigo-300'>limit</code>,{' '}
										<code className='text-indigo-300'>offset</code>. Папки: INBOX,
										Sent, Trash, Drafts, Junk.
									</p>
								</div>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Прочитать письмо
								</h3>
								<div className='bg-gray-800/30 p-4 rounded-lg border border-white/10'>
									<div className='flex items-center mb-2'>
										<span className='bg-green-500/20 text-green-400 px-2 py-1 rounded mr-2 border border-green-500/30'>
											GET
										</span>
										<code className='text-gray-300'>
											/mail/messages/{'{uid}'}
										</code>
									</div>
									<p className='text-gray-300 text-sm'>
										Право <code className='text-indigo-300'>read</code>. Query:{' '}
										<code className='text-indigo-300'>folder</code>. Ответ:{' '}
										<code className='text-indigo-300'>body_text</code>,{' '}
										<code className='text-indigo-300'>body_html</code>, тема,
										отправитель, флаг <code className='text-indigo-300'>seen</code>
										.
									</p>
								</div>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									В корзину
								</h3>
								<div className='bg-gray-800/30 p-4 rounded-lg border border-white/10'>
									<div className='flex items-center mb-2'>
										<span className='bg-blue-500/20 text-blue-400 px-2 py-1 rounded mr-2 border border-blue-500/30'>
											POST
										</span>
										<code className='text-gray-300'>
											/mail/messages/{'{uid}'}/trash
										</code>
									</div>
									<p className='text-gray-300 text-sm'>
										Право <code className='text-indigo-300'>delete</code>. Query
										или body: <code className='text-indigo-300'>folder</code>.
									</p>
								</div>
							</div>

							<div>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Веб-интерфейс (cookie)
								</h3>
								<p className='text-gray-300 text-sm'>
									Для браузера:{' '}
									<code className='text-indigo-300'>/api/v2/mail/*</code> с сессией
									(ящик, папки, отправка, корзина, настройка прав{' '}
									<code className='text-indigo-300'>
										PUT /api/v2/mail/api-permissions
									</code>
									).
								</p>
							</div>
						</section>
					</div>
				)

			case 'vondicapi':
				return (
					<div className='space-y-6'>
						<section>
							<h2 className='text-2xl font-bold mb-4 text-white'>ВондикAPI</h2>
							<p className='mb-4 text-gray-300'>
								ВондикAPI - это клиентская библиотека Python для взаимодействия
								с публичным API социальной сети Вондик.
							</p>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Установка
								</h3>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`pip install vondic_api`}
								</pre>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Быстрый старт
								</h3>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`from vondic_api import VondicClient

# Инициализация клиента с вашим API-ключом
client = VondicClient(api_key="your_api_key_here")

# Получить текущего пользователя
current_user = client.get_current_user()
print(f"Привет, {current_user.username}!")

# Получить последние посты
posts = client.get_posts(limit=10)
for post in posts:
    print(f"{post.user.username}: {post.content}")

# Создать новый пост
new_post = client.create_post(
    content="Привет из клиентской библиотеки Вондик API!",
    privacy="public"
)
print(f"Создан пост с ID: {new_post.id}")`}
								</pre>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Управление пользователями
								</h3>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`# Получить пользователя по ID
user = client.get_user(user_id="user123")

# Получить список пользователей
users = client.get_users(limit=20)

# Обновить профиль текущего пользователя
updated_user = client.update_user(
    username="new_username",
    bio="Новое описание профиля"
)

# Подписаться/отписаться от пользователя
client.follow_user("target_user_id")
client.unfollow_user("target_user_id")`}
								</pre>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Управление постами
								</h3>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`# Получить конкретный пост
post = client.get_post(post_id="post123")

# Создать новый пост
new_post = client.create_post(
    content="Содержание нового поста",
    privacy="public",  # public, friends, private
    media_urls=["https://example.com/image.jpg"],
    tags=["tag1", "tag2"]
)

# Обновить пост
updated_post = client.update_post(
    post_id="post123",
    content="Обновленное содержание"
)

# Поставить/убрать лайк
client.like_post("post123")
client.unlike_post("post123")`}
								</pre>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Обмен сообщениями
								</h3>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`# Отправить сообщение
message = client.send_message(
    recipient_id="recipient_user_id",
    content="Текст сообщения",
    media_urls=["https://example.com/image.jpg"]
)

# Получить сообщения
messages = client.get_messages(limit=20)

# Получить переписки
threads = client.get_message_threads(limit=10)`}
								</pre>
							</div>

							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Работа с комментариями
								</h3>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`# Получить комментарии к посту
comments = client.get_comments_for_post(post_id="post123", limit=20)

# Создать комментарий
comment = client.create_comment(
    post_id="post123",
    content="Текст комментария"
)

# Обновить комментарий
updated_comment = client.update_comment(
    comment_id="comment123",
    content="Обновленный текст комментария"
)

# Удалить комментарий
client.delete_comment("comment123")`}
								</pre>
							</div>
						</section>
					</div>
				)

			default:
				return null
		}
	}

	return (
		<div className='min-h-screen bg-black text-white selection:bg-indigo-500 selection:text-white overflow-x-hidden'>
			
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px]' />
				<div className='absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full bg-purple-900/20 blur-[120px]' />
				<div className='absolute bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-emerald-900/10 blur-[100px]' />
			</div>

			<div className='relative z-10 min-h-screen py-8'>
				<div className='max-w-6xl mx-auto px-4'>
					<header className='mb-8 text-center'>
						<h1 className='text-4xl font-bold text-white mb-2'>
							Документация API Вондик
						</h1>
						<p className='text-lg text-gray-300'>
							Создавайте приложения, которые интегрируются с нашей социальной
							сетью
						</p>
					</header>

					<div className='bg-white/5 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden border border-white/10'>
						<div className='border-b border-white/10'>
							<nav className='flex overflow-x-auto'>
								{tabs.map(tab => (
									<button
										key={tab.id}
										className={`px-6 py-4 font-medium text-sm whitespace-nowrap ${
											activeTab === tab.id
												? 'text-indigo-400 border-b-2 border-indigo-400'
												: 'text-gray-400 hover:text-gray-200'
										}`}
										onClick={() => setActiveTab(tab.id)}
									>
										{tab.label}
									</button>
								))}
							</nav>
						</div>

						<div className='p-6'>{renderContent()}</div>
					</div>

					<footer className='mt-12 text-center text-gray-500 text-sm'>
						<p>
							© {new Date().getFullYear()} Социальная сеть Вондик. Все права
							защищены.
						</p>
						<p className='mt-2'>
							По вопросам поддержки обращайтесь в нашу команду разработчиков.
						</p>
					</footer>
				</div>
			</div>
		</div>
	)
}

export default ApiDocumentationPage
