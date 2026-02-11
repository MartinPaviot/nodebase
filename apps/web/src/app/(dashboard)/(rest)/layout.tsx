const Layout = ({ children }: { children: React.ReactNode; }) =>
    {
        return (
            <main className="flex-1 w-full">{children}</main>
        );
    };

export default Layout;