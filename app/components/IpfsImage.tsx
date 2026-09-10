"use client"
import Image, { ImageProps } from "next/image"
import { FC, ReactEventHandler, useState } from "react"
import TokenImagePlaceholder from "@components/TokenImagePlaceholder"

const IpfsImage: FC<ImageProps> = (props) => {
    const { alt, onLoad, onError, className, ...rest } = props
    const [loading, setLoading] = useState(true)
    const [failed, setFailed] = useState(false)

    const handleLoad: ReactEventHandler<HTMLImageElement> = (e) => {
        setLoading(false)
        onLoad?.(e)
    }

    const handleError: ReactEventHandler<HTMLImageElement> = (e) => {
        setFailed(true)
        onError?.(e)
    }

    if (failed) {
        return <TokenImagePlaceholder />
    }

    return (
        <Image
            alt={alt}
            onLoad={handleLoad}
            onError={handleError}
            className={`${loading ? "skeleton" : ""} ${className}`}
            {...rest}
        />
    )
}

export default IpfsImage
