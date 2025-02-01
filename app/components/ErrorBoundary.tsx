"use client"
import { errorToMessage } from '@cardano/utils';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import React, { Component, ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    error?: Error
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {};
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }


    render() {
        const error = this.state.error;
        if (error) {
            console.log("LOGGING", error);
            return (
                <div className="w-full h-full flex items-center justify-center gap-2">
                    <ExclamationCircleIcon className="h-6" />
                    <span className="f">{errorToMessage(error)}</span>
                </div>
            )
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
