'use client'

import { useState } from 'react'

const ApiDocumentationPage = () => {
	const [activeTab, setActiveTab] = useState('overview')

	const tabs = [
		{ id: 'overview', label: 'Обзор' },
		{ id: 'authentication', label: 'Аутентификация' },
		{ id: 'users', label: 'Пользователи' },
		{ id: 'posts', label: 'Посты' },
		{ id: 'messages', label: 'Сообщения' },
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
								Добро пожаловать в документацию по публичному API социальной
								сети Вондик. Этот API позволяет разработчикам интегрироваться с
								нашей платформой социальной сети и создавать приложения, которые
								взаимодействуют с пользователями, постами, сообщениями и другими
								социальными функциями.
							</p>
							<div className='bg-indigo-500/10 border-l-4 border-indigo-500 p-4 mb-4 backdrop-blur-sm border border-white/10 rounded-lg'>
								<p className='font-semibold text-white'>Базовый URL:</p>
								<code className='bg-gray-800/50 px-2 py-1 rounded text-indigo-300 border border-white/10'>
									https://api.vondic.knopusmedia.ru
								</code>
							</div>
							<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
								<div className='border rounded-lg p-4 backdrop-blur-sm border-white/10 bg-white/5'>
									<h3 className='font-bold mb-2 text-white'>
										Ограничения по запросам
									</h3>
									<p className='text-gray-300'>
										Запросы ограничены 1000 в час на один API ключ
									</p>
								</div>
								<div className='border rounded-lg p-4 backdrop-blur-sm border-white/10 bg-white/5'>
									<h3 className='font-bold mb-2 text-white'>Версионирование</h3>
									<p className='text-gray-300'>
										Текущая версия: v1 (изменения будут обратно совместимыми)
									</p>
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
									Включайте ваш API ключ в заголовок Authorization:
								</p>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`Authorization: Bearer YOUR_API_KEY`}
								</pre>
							</div>

							<div>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Пример запроса
								</h3>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`curl -X GET \\
  "https://api.vondic.knopusmedia.ru/api/public/v1/users/me" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
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
									{`Authorize: https://vondic.knopusmedia.ru/oauth/authorize
Token:     https://vondic.knopusmedia.ru/oauth/token
Userinfo:  https://vondic.knopusmedia.ru/oauth/userinfo`}
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
									{`curl -X POST https://vondic.knopusmedia.ru/oauth/token \\
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
									{`curl https://vondic.knopusmedia.ru/oauth/userinfo \\
  -H "Authorization: Bearer ACCESS_TOKEN"`}
								</pre>
							</div>
							<div className='mb-6'>
								<h3 className='text-xl font-semibold mb-2 text-white'>
									Refresh token
								</h3>
								<pre className='bg-gray-800/50 p-3 rounded overflow-x-auto border border-white/10 text-gray-200'>
									{`curl -X POST https://vondic.knopusmedia.ru/oauth/token \\
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
  res.redirect("https://vondic.knopusmedia.ru/oauth/authorize?" + qs);
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
  "https://vondic.knopusmedia.ru/oauth/authorize?" +
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
bot = Bot(token="YOUR_BOT_TOKEN", base_url="https://vondic.knopusmedia.ru")

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
    kb.add(InlineKeyboardButton(text="Сайт", url="https://vondic.knopusmedia.ru"))
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
token_resp = requests.post("https://vondic.knopusmedia.ru/oauth/token", data={
    "grant_type": "authorization_code",
    "code": "AUTH_CODE",
    "redirect_uri": "https://app.example.com/callback",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
})
access_token = token_resp.json()["access_token"]

# 2. get api key by oauth token
client = PublicAPIClient(base_url="https://vondic.knopusmedia.ru")
api_key = client.get_api_key(access_token=access_token)["api_key"]

# 3. list bots / generate bot token
bots = client.list_bots(api_key=api_key)
print("bots:", bots)`}
								</pre>
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
