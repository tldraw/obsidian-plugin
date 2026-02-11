import React, { ReactNode } from 'react'
import TextSuggestions from './TextSuggestions'

export default function InFrontOfTheCanvas({ children }: { children?: ReactNode }) {
	return (
		<>
			{children}
			<TextSuggestions />
		</>
	)
}
