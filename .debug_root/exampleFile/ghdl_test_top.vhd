library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity ghdl_test_top is
    port (
        clk      : in  std_logic;
        rst      : in  std_logic;
        enable   : in  boolean;
        data_in  : in  std_logic_vector(3 downto 0);
        done     : out boolean;
        data_out : out std_logic_vector(3 downto 0)
    );
end entity;

architecture rtl of ghdl_test_top is
    signal counter : integer := 0;
    signal data_register : std_logic_vector(3 downto 0) := (others => '1');
    signal done_register : boolean := true;
begin
    data_out <= data_register;
    done <= done_register;

    process (clk)
    begin
        if rising_edge(clk) then
            if rst = '1' then
                counter <= 0;
                data_register <= (others => '0');
                done_register <= false;
            elsif enable then
                counter <= counter + 1;
                data_register <= std_logic_vector(to_unsigned(counter, 4));
                if counter = 15 then
                    done_register <= true;
                else
                    done_register <= false;
                end if;
            end if;
        end if;
    end process;
end architecture;
