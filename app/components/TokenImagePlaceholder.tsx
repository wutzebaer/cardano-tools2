import Image from "next/image";

export default function TokenImagePlaceholder() {
    return (
        <div className="flex aspect-square w-full items-center justify-center bg-base-300">
            <Image
                src="/images/cardano-tools-logo.svg"
                alt=""
                width={577}
                height={524}
                className="w-2/5 opacity-50"
            />
        </div>
    );
}
