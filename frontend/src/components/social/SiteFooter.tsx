'use client'

export default function SiteFooter() {
	return (
		<footer className='py-8 relative z-10 border-t border-white/5 mt-auto shrink-0'>
			<div className='max-w-2xl mx-auto px-4 text-center'>
				<div className='grid grid-cols-2 gap-x-6 gap-y-1 mb-3 text-xs text-gray-500 max-w-md mx-auto'>
					<a href='https://s3.vondic.ru/uploads/docs/privacy_policy.rtf' target='_blank' rel='noopener' className='hover:text-gray-300 transition-colors text-right'>Политика конфиденциальности</a>
					<a href='https://s3.vondic.ru/uploads/docs/consent_to_processing_personal_data.rtf' target='_blank' rel='noopener' className='hover:text-gray-300 transition-colors'>Согласие на обработку данных</a>
					<a href='https://s3.vondic.ru/uploads/docs/data_storage_and_destroyal_order.rtf' target='_blank' rel='noopener' className='hover:text-gray-300 transition-colors text-right'>Порядок хранения данных</a>
					<a href='https://s3.vondic.ru/uploads/docs/moderation_regulations_and_reasons_for_blocking.rtf' target='_blank' rel='noopener' className='hover:text-gray-300 transition-colors'>Правила модерации</a>
					<a href='https://s3.vondic.ru/uploads/docs/regulations_for_reviewing_complaints_and_moderating_content.rtf' target='_blank' rel='noopener' className='hover:text-gray-300 transition-colors text-right'>Рассмотрение жалоб</a>
					<a href='https://s3.vondic.ru/uploads/docs/сommunity_rules.rtf' target='_blank' rel='noopener' className='hover:text-gray-300 transition-colors'>Правила сообщества</a>
				</div>
				<p className='text-gray-600 text-[11px]'>{`© 2026 Вондик`}</p>
			</div>
		</footer>
	)
}
