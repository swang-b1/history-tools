#pragma once

#include <string>
#include <vector>
#include "abieos.hpp"
#include <variant>
#include <exception>
using namespace std::__1;

using db_type = std::string;

struct serilization_exception: public std::exception{
    const char* waht() const throw (){
        return "flat serilizer exception.";
    }
};

#define SER_ASSERT(x) if(!(x))throw serilization_exception()

struct flat_serializer{
    std::vector< std::string> types;
    std::vector< std::string> names;

    flat_serializer(const std::vector<std::string>& _names, const std::vector<std::string>& _types):
    types(_types),
    names(_names)
    {}

    std::vector<std::tuple<std::string,db_type>> serialize(abieos::input_buffer& buffer){
        std::string error;
        std::vector<std::tuple<std::string,db_type>> result;

        for(uint32_t i = 0;i<types.size(); i++){
            auto& t = types[i];
            auto& n = names[i];
            if(t == "string"){
                std::string dest;
                SER_ASSERT(abieos::read_string(buffer,error,dest));
                result.emplace_back(n,dest);
            }
            else if(t == "name"){
                uint64_t data = 0;
                std::cout << t << std::endl;
                SER_ASSERT(abieos::read_raw(buffer,error,data));
                result.emplace_back(n,abieos::name_to_string(data));
            }
            else if(t == "asset"){
                std::cout << t << std::endl;
                uint64_t amount,symbol;
                SER_ASSERT(abieos::read_raw(buffer,error,amount));
                result.emplace_back(n+"_amount",std::to_string(amount));
                SER_ASSERT(abieos::read_raw(buffer,error,symbol));
                result.emplace_back(n+"_symbol",abieos::symbol_code_to_string(symbol >> 8));
                
            }
            else if(t == "bool"){
                std::cout << t << std::endl;
                bool data;
                SER_ASSERT(abieos::read_raw(buffer,error,data));
                result.emplace_back(n,std::to_string(data));
            }
            else if(t == "uint64"){
                std::cout << t << std::endl;
                uint64_t data;
                SER_ASSERT(abieos::read_raw(buffer,error,data));
                result.emplace_back(n,std::to_string(data));
            }else{
                return result;
            }
        }
        return result;
    }

};